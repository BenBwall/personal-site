import { randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import { readFile, readdir, stat } from 'node:fs/promises';
import { posix, resolve as resolvePath } from 'node:path';
import { fileURLToPath } from 'node:url';

import { Client, type FileEntryWithStats, type SFTPWrapper } from 'ssh2';

const SSH_PORT = 22;
const READY_TIMEOUT_MS = 10_000;
const PER_HOST_CONCURRENCY = 3;
const PUBLIC_CHECK_ATTEMPTS = 10;
const PUBLIC_CHECK_DELAY_MS = 3_000;
const PUBLIC_REQUEST_TIMEOUT_MS = 15_000;
const SHARE_TOKEN_BYTES = 32;
const REMOTE_ROOT = '/home/b/bergenwb/html';
const HOSTS = ['penti.arcada.fi', 'xena.arcada.fi', 'gabrielle.arcada.fi'] as const;
const SITE_ROOT = resolvePath(
  process.env.DOMUS_SITE_DIR ?? fileURLToPath(new URL('../site/', import.meta.url)),
);
const PROTECTED_PATHS = new Set([
  '.htaccess',
  '.personal-site-deploy-target',
  'deployment.json',
] as const);

type ProtectedPath = typeof PROTECTED_PATHS extends ReadonlySet<infer T> ? T : never;
const USERNAME = process.env.ARCADA_USERNAME;
const PASSWORD = process.env.ARCADA_PASSWORD;

type Session = Readonly<{ host: string; client: Client; sftp: SFTPWrapper; revision: string }>;
type LocalSite = Readonly<{
  files: ReadonlyMap<string, Readonly<{ absolute: string; size: number }>>;
  dirs: ReadonlySet<string>;
}>;
type RemoteSite = Readonly<{ files: ReadonlySet<string>; dirs: ReadonlySet<string> }>;

if (!/^[a-zA-Z0-9._-]+$/.test(USERNAME ?? '')) {
  throw new Error('ARCADA_USERNAME must be a bare account name.');
}
if (!PASSWORD) {
  throw new Error('Set ARCADA_PASSWORD in the domus environment.');
}

const knownHosts = await readFile(
  fileURLToPath(new URL('../.github/domus_known_hosts', import.meta.url)),
  'utf8',
);
const expectedMarker = await readFile(
  fileURLToPath(new URL('../.github/domus-deploy-target', import.meta.url)),
);
const pinnedKeys = new Map<string, Buffer>(
  knownHosts
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => {
      const [host, , base64] = line.split(/\s+/);
      return [host, Buffer.from(base64, 'base64')];
    }),
);

const connect = (host: string): Promise<Client> =>
  new Promise<Client>((resolve, reject) => {
    const pinned = pinnedKeys.get(host);
    if (!pinned) {
      reject(new Error(`No pinned host key for ${host}`));
      return;
    }
    const client = new Client();
    let ready = false;
    client.on('ready', () => {
      ready = true;
      resolve(client);
    });
    client.on('error', (error) => {
      if (!ready) {
        reject(error);
      }
    });
    client.on('keyboard-interactive', (_name, _instructions, _language, prompts, finish) => {
      finish(prompts.map(() => PASSWORD));
    });
    const verifyHostKey = (key: Buffer) =>
      key.length === pinned.length && timingSafeEqual(key, pinned);
    client.connect({
      host,
      hostVerifier: verifyHostKey,
      password: PASSWORD,
      port: SSH_PORT,
      readyTimeout: READY_TIMEOUT_MS,
      tryKeyboard: true,
      username: USERNAME,
    });
  });

const openSftp = (client: Client): Promise<SFTPWrapper> =>
  new Promise<SFTPWrapper>((resolve, reject) => {
    client.sftp((error, sftp) => {
      if (error) {
        reject(error);
      } else {
        sftp.on('error', (channelError: unknown) => {
          process.stderr.write(
            `SFTP channel error: ${channelError instanceof Error ? channelError.message : String(channelError)}\n`,
          );
        });
        resolve(sftp);
      }
    });
  });

const readRemote = (sftp: SFTPWrapper, path: string): Promise<Buffer> =>
  new Promise<Buffer>((resolve, reject) => {
    sftp.readFile(path, (error, data) => {
      if (error) {
        reject(error);
      } else {
        resolve(data);
      }
    });
  });

const writeRemote = (sftp: SFTPWrapper, path: string, content: Buffer): Promise<void> =>
  new Promise<void>((resolve, reject) => {
    sftp.writeFile(path, content, (error) => {
      if (error) {
        reject(error);
      } else {
        resolve();
      }
    });
  });

const listRemote = (sftp: SFTPWrapper, path: string): Promise<FileEntryWithStats[]> =>
  new Promise<FileEntryWithStats[]>((resolve, reject) => {
    sftp.readdir(path, (error, entries) => {
      if (error) {
        reject(error);
      } else {
        resolve(entries);
      }
    });
  });

const makeRemoteDir = (sftp: SFTPWrapper, path: string): Promise<void> =>
  new Promise<void>((resolve, reject) => {
    sftp.mkdir(path, (error) => {
      if (error) {
        reject(error);
      } else {
        resolve();
      }
    });
  });

const removeRemoteFile = (sftp: SFTPWrapper, path: string): Promise<void> =>
  new Promise<void>((resolve, reject) => {
    sftp.unlink(path, (error) => {
      if (error) {
        reject(error);
      } else {
        resolve();
      }
    });
  });

const removeRemoteDir = (sftp: SFTPWrapper, path: string): Promise<void> =>
  new Promise<void>((resolve, reject) => {
    sftp.rmdir(path, (error) => {
      if (error) {
        reject(error);
      } else {
        resolve();
      }
    });
  });

const remotePath = (relative: string): string => {
  if (
    !relative ||
    relative.startsWith('/') ||
    relative.split('/').some((part) => !part || part === '.' || part === '..')
  ) {
    throw new Error(`Unsafe remote path: ${relative}`);
  }
  return posix.join(REMOTE_ROOT, relative);
};

const isProtectedPath = (relative: string): boolean =>
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion
  PROTECTED_PATHS.has(posix.basename(relative) as ProtectedPath);

const sortPaths = (
  values: Iterable<string>,
  compare = (left: string, right: string) => left.localeCompare(right),
): string[] => {
  const copy = [...values];
  // The configured TypeScript lib omits toSorted; the copied array is safe to mutate.
  // oxlint-disable-next-line unicorn/no-array-sort
  return copy.sort(compare);
};

const errorText = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

const openSession = async (host: string): Promise<Session> => {
  let client: Client | undefined;
  try {
    client = await connect(host);
    const sftp = await openSftp(client);
    const actualMarker = await readRemote(sftp, remotePath('.personal-site-deploy-target'));
    if (!actualMarker.equals(expectedMarker)) {
      throw new Error('target marker differs');
    }
    const revision = (await readRemote(sftp, remotePath('deployment.json')))
      .toString('utf8')
      .trim();
    return { client, host, revision, sftp };
  } catch (error) {
    client?.end();
    throw error;
  }
};

const discoverSessions = async (): Promise<Session[]> => {
  const results = await Promise.allSettled(HOSTS.map(openSession));
  const sessions: Session[] = [];
  for (const [index, result] of results.entries()) {
    if (result.status === 'fulfilled') {
      sessions.push(result.value);
      process.stdout.write(`${HOSTS[index]}: target verified, ${result.value.revision}\n`);
    } else {
      process.stdout.write(`${HOSTS[index]}: ${errorText(result.reason)}\n`);
    }
  }
  return sessions;
};

const verifySharedStorage = async (sessions: Session[]): Promise<Session[]> => {
  if (sessions.length === 0) {
    throw new Error('No verified SFTP host is available.');
  }
  const primary = sessions[0];
  const sharedPath = remotePath(`.personal-site-share-${randomUUID()}`);
  const sharedToken = randomBytes(SHARE_TOKEN_BYTES);
  await writeRemote(primary.sftp, sharedPath, sharedToken);
  try {
    const results = await Promise.allSettled(
      sessions.map(async (session) => {
        const visible = await readRemote(session.sftp, sharedPath);
        if (!visible.equals(sharedToken)) {
          throw new Error('primary write is not visible');
        }
        if (session === primary) {
          return session;
        }
        const returnPath = remotePath(`.personal-site-share-${randomUUID()}`);
        const returnToken = randomBytes(SHARE_TOKEN_BYTES);
        await writeRemote(session.sftp, returnPath, returnToken);
        try {
          const returned = await readRemote(primary.sftp, returnPath);
          if (!returned.equals(returnToken)) {
            throw new Error('write is not visible to the primary host');
          }
          return session;
        } finally {
          await removeRemoteFile(session.sftp, returnPath);
        }
      }),
    );
    const shared: Session[] = [];
    for (const [index, result] of results.entries()) {
      if (result.status === 'fulfilled') {
        shared.push(result.value);
      } else {
        process.stdout.write(
          `${sessions[index].host}: shared storage check failed: ${errorText(result.reason)}\n`,
        );
      }
    }
    return shared;
  } finally {
    await removeRemoteFile(primary.sftp, sharedPath);
  }
};

const scanLocal = async (): Promise<LocalSite> => {
  const files = new Map<string, { absolute: string; size: number }>();
  const dirs = new Set<string>();
  const visit = async (directory: string, relative: string): Promise<void> => {
    const entries = await readdir(directory, { withFileTypes: true });
    await Promise.all(
      entries.map(async (entry) => {
        const nextRelative = posix.join(relative, entry.name);
        const absolute = resolvePath(directory, entry.name);
        remotePath(nextRelative);
        if (entry.isSymbolicLink()) {
          throw new Error(`The build contains a symbolic link: ${nextRelative}`);
        }
        if (entry.isDirectory()) {
          dirs.add(nextRelative);
          await visit(absolute, nextRelative);
        } else if (entry.isFile()) {
          if (isProtectedPath(nextRelative)) {
            throw new Error(`The build contains a reserved deployment file: ${nextRelative}`);
          }
          files.set(nextRelative, { absolute, size: (await stat(absolute)).size });
        } else {
          throw new Error(`The build contains an unsupported entry: ${nextRelative}`);
        }
      }),
    );
  };
  await visit(SITE_ROOT, '');
  if (!files.has('index.html')) {
    throw new Error('The build is missing index.html.');
  }
  return { dirs, files };
};

const scanRemote = async (sftp: SFTPWrapper): Promise<RemoteSite> => {
  const files = new Set<string>();
  const dirs = new Set<string>();
  const visit = async (relative: string): Promise<void> => {
    const entries = await listRemote(sftp, relative ? remotePath(relative) : REMOTE_ROOT);
    await Promise.all(
      entries.map(async (entry) => {
        const name = entry.filename;
        if (name === '.' || name === '..') {
          return;
        }
        if (!name || name.includes('/') || name.includes('\\')) {
          throw new Error(`Unsafe name in remote listing: ${name}`);
        }
        const nextRelative = posix.join(relative, name);
        remotePath(nextRelative);
        if (entry.attrs.isSymbolicLink()) {
          throw new Error(`Remote site contains a symbolic link: ${nextRelative}`);
        }
        if (entry.attrs.isDirectory()) {
          dirs.add(nextRelative);
          await visit(nextRelative);
        } else if (entry.attrs.isFile()) {
          files.add(nextRelative);
        } else {
          throw new Error(`Remote site contains an unsupported entry: ${nextRelative}`);
        }
      }),
    );
  };
  await visit('');
  if (!files.has('.htaccess') || !files.has('.personal-site-deploy-target')) {
    throw new Error('The remote site is missing a protected target file.');
  }
  return { dirs, files };
};

const settleAll = async (tasks: Promise<void>[]): Promise<void> => {
  const results = await Promise.allSettled(tasks);
  const failure = results.find((result) => result.status === 'rejected');
  if (failure?.status === 'rejected') {
    throw failure.reason instanceof Error ? failure.reason : new Error(String(failure.reason));
  }
};

type ItemAction = (session: Session, item: string) => Promise<void>;

const runBucket = async (session: Session, items: string[], action: ItemAction): Promise<void> => {
  let cursor = 0;
  const next = async () => {
    if (cursor >= items.length) {
      return;
    }
    const item = items[cursor];
    cursor += 1;
    await action(session, item);
    await next();
  };
  await settleAll(Array.from({ length: Math.min(PER_HOST_CONCURRENCY, items.length) }, next));
};

const runDistributed = async (
  sessions: Session[],
  items: string[],
  action: ItemAction,
): Promise<void> => {
  const buckets: string[][] = sessions.map(() => []);
  for (const [index, item] of items.entries()) {
    buckets[index % sessions.length].push(item);
  }
  await settleAll(sessions.map((session, index) => runBucket(session, buckets[index], action)));
};

const syncSite = async (sessions: Session[], local: LocalSite): Promise<string> => {
  if (sessions.length === 0) {
    throw new Error('No SFTP host shares the marked target directory.');
  }
  const primary = sessions[0];
  const remote = await scanRemote(primary.sftp);
  for (const relative of local.dirs) {
    if (remote.files.has(relative)) {
      throw new Error(`A remote file blocks a build directory: ${relative}`);
    }
  }
  for (const relative of local.files.keys()) {
    if (remote.dirs.has(relative)) {
      throw new Error(`A remote directory blocks a build file: ${relative}`);
    }
  }
  const newDirs = sortPaths(
    [...local.dirs].filter((relative) => !remote.dirs.has(relative)),
    (left, right) => left.split('/').length - right.split('/').length || left.localeCompare(right),
  );
  await newDirs.reduce(
    (previous, relative) => previous.then(() => makeRemoteDir(primary.sftp, remotePath(relative))),
    Promise.resolve(),
  );

  const contentFiles = sortPaths(
    [...local.files.keys()].filter((relative) => relative !== 'index.html'),
  );
  process.stdout.write(
    `Uploading ${contentFiles.length} content files across ${sessions.length} SFTP hosts.\n`,
  );
  await runDistributed(sessions, contentFiles, async (session, relative) => {
    const file = local.files.get(relative);
    if (!file) {
      throw new Error(`Missing local build file: ${relative}`);
    }
    await writeRemote(session.sftp, remotePath(relative), await readFile(file.absolute));
  });

  const index = local.files.get('index.html');
  if (!index) {
    throw new Error('The build is missing index.html.');
  }
  const indexContent = await readFile(index.absolute);
  await writeRemote(primary.sftp, remotePath('index.html'), indexContent);

  const staleFiles = sortPaths(
    [...remote.files].filter(
      (relative) => !local.files.has(relative) && !isProtectedPath(relative),
    ),
  );
  process.stdout.write(`Removing ${staleFiles.length} stale files.\n`);
  await runDistributed(sessions, staleFiles, (session, relative) =>
    removeRemoteFile(session.sftp, remotePath(relative)),
  );
  const staleDirs = sortPaths(
    [...remote.dirs].filter(
      (relative) =>
        !local.dirs.has(relative) &&
        ![...remote.files].some((file) => isProtectedPath(file) && file.startsWith(`${relative}/`)),
    ),
    (left, right) => right.split('/').length - left.split('/').length || right.localeCompare(left),
  );
  await staleDirs.reduce(
    (previous, relative) =>
      previous.then(() => removeRemoteDir(primary.sftp, remotePath(relative))),
    Promise.resolve(),
  );

  const actualIndex = await readRemote(primary.sftp, remotePath('index.html'));
  if (!actualIndex.equals(indexContent)) {
    throw new Error('The remote homepage differs from the build.');
  }
  const revision = process.env.GITHUB_SHA;
  if (!/^[a-f0-9]{40}$/.test(revision ?? '')) {
    throw new Error('GITHUB_SHA must be a full commit SHA.');
  }
  const receipt = Buffer.from(`${JSON.stringify({ revision })}\n`);
  await writeRemote(primary.sftp, remotePath('deployment.json'), receipt);
  process.stdout.write(
    `Published ${revision} through ${sessions.map((session) => session.host).join(', ')}.\n`,
  );
  return receipt.toString('utf8').trim();
};

const verifyPublic = async (expected: string, remaining: number): Promise<void> => {
  const revision = process.env.GITHUB_SHA;
  const url = `https://people.arcada.fi/~bergenwb/deployment.json?rev=${revision}`;
  const actual = await fetch(url, {
    headers: { 'Cache-Control': 'no-cache' },
    signal: AbortSignal.timeout(PUBLIC_REQUEST_TIMEOUT_MS),
  })
    .then((response) => (response.ok ? response.text() : ''))
    .catch(() => '');
  if (actual.trim() === expected) {
    process.stdout.write(`The public site serves ${revision}.\n`);
    return;
  }
  if (remaining <= 1) {
    throw new Error('The public site did not serve the deployed revision.');
  }
  await new Promise((resolve) => {
    setTimeout(resolve, PUBLIC_CHECK_DELAY_MS);
  });
  await verifyPublic(expected, remaining - 1);
};

if (process.argv.includes('--plan')) {
  const local = await scanLocal();
  const bytes = [...local.files.values()].reduce((total, file) => total + file.size, 0);
  process.stdout.write(
    `Build: ${local.files.size} files, ${local.dirs.size} directories, ${bytes} bytes.\n`,
  );
} else {
  let sessions: Session[] = [];
  let receipt: string | undefined;
  try {
    sessions = await discoverSessions();
    if (process.argv.includes('--probe')) {
      process.stdout.write(`${sessions.length} of ${HOSTS.length} SFTP targets verified.\n`);
    } else {
      const local = await scanLocal();
      const shared = await verifySharedStorage(sessions);
      process.stdout.write(`${shared.length} SFTP hosts share the target directory.\n`);
      receipt = await syncSite(shared, local);
    }
  } finally {
    for (const session of sessions) {
      session.client.end();
    }
  }
  if (receipt) {
    await verifyPublic(receipt, PUBLIC_CHECK_ATTEMPTS);
  }
}
