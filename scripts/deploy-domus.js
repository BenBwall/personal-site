import { randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import { readFile, readdir, stat } from 'node:fs/promises';
import { posix, resolve as resolvePath } from 'node:path';
import { fileURLToPath } from 'node:url';

import { Client } from 'ssh2';

const sshPort = 22;
const readyTimeoutMs = 10_000;
const perHostConcurrency = 3;
const publicCheckAttempts = 10;
const publicCheckDelayMs = 3_000;
const publicRequestTimeoutMs = 15_000;
const shareTokenBytes = 32;
const remoteRoot = '/home/b/bergenwb/html';
const hosts = ['penti.arcada.fi', 'xena.arcada.fi', 'gabrielle.arcada.fi'];
const siteRoot = resolvePath(
  process.env.DOMUS_SITE_DIR ?? fileURLToPath(new URL('../site/', import.meta.url)),
);
const protectedPaths = new Set(['.htaccess', '.personal-site-deploy-target', 'deployment.json']);
const username = process.env.ARCADA_USERNAME;
const password = process.env.ARCADA_PASSWORD;

/** @typedef {import('ssh2').SFTPWrapper} Sftp */
/** @typedef {{ host: string, client: Client, sftp: Sftp, revision: string }} Session */

if (!/^[a-zA-Z0-9._-]+$/.test(username ?? '')) {
  throw new Error('ARCADA_USERNAME must be a bare account name.');
}
if (!password) {
  throw new Error('Set ARCADA_PASSWORD in the domus environment.');
}

const knownHosts = await readFile(
  fileURLToPath(new URL('../.github/domus_known_hosts', import.meta.url)),
  'utf8',
);
const expectedMarker = await readFile(
  fileURLToPath(new URL('../.github/domus-deploy-target', import.meta.url)),
);
/** @type {Map<string, Buffer>} */
const pinnedKeys = new Map(
  knownHosts
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => {
      const [host, , base64] = line.split(/\s+/);
      return [host, Buffer.from(base64, 'base64')];
    }),
);

/** @param {string} host @returns {Promise<Client>} */
const connect = (host) =>
  new Promise((resolve, reject) => {
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
      finish(prompts.map(() => password));
    });
    /** @param {Buffer} key */
    const verifyHostKey = (key) => key.length === pinned.length && timingSafeEqual(key, pinned);
    client.connect({
      host,
      hostVerifier: verifyHostKey,
      password,
      port: sshPort,
      readyTimeout: readyTimeoutMs,
      tryKeyboard: true,
      username,
    });
  });

/** @param {Client} client @returns {Promise<import('ssh2').SFTPWrapper>} */
const openSftp = (client) =>
  new Promise((resolve, reject) => {
    client.sftp((error, sftp) => {
      if (error) {
        reject(error);
      } else {
        sftp.on('error', (channelError) => {
          process.stderr.write(
            `SFTP channel error: ${channelError instanceof Error ? channelError.message : String(channelError)}\n`,
          );
        });
        resolve(sftp);
      }
    });
  });

/** @param {import('ssh2').SFTPWrapper} sftp @param {string} path @returns {Promise<Buffer>} */
const readRemote = (sftp, path) =>
  new Promise((resolve, reject) => {
    sftp.readFile(path, (error, data) => {
      if (error) {
        reject(error);
      } else {
        resolve(data);
      }
    });
  });

/** @param {Sftp} sftp @param {string} path @param {Buffer} content @returns {Promise<void>} */
const writeRemote = (sftp, path, content) =>
  new Promise((resolve, reject) => {
    sftp.writeFile(path, content, (error) => {
      if (error) {
        reject(error);
      } else {
        resolve();
      }
    });
  });

/** @param {Sftp} sftp @param {string} path @returns {Promise<import('ssh2').FileEntryWithStats[]>} */
const listRemote = (sftp, path) =>
  new Promise((resolve, reject) => {
    sftp.readdir(path, (error, entries) => {
      if (error) {
        reject(error);
      } else {
        resolve(entries);
      }
    });
  });

/** @param {Sftp} sftp @param {string} path @returns {Promise<void>} */
const makeRemoteDir = (sftp, path) =>
  new Promise((resolve, reject) => {
    sftp.mkdir(path, (error) => {
      if (error) {
        reject(error);
      } else {
        resolve();
      }
    });
  });

/** @param {Sftp} sftp @param {string} path @returns {Promise<void>} */
const removeRemoteFile = (sftp, path) =>
  new Promise((resolve, reject) => {
    sftp.unlink(path, (error) => {
      if (error) {
        reject(error);
      } else {
        resolve();
      }
    });
  });

/** @param {Sftp} sftp @param {string} path @returns {Promise<void>} */
const removeRemoteDir = (sftp, path) =>
  new Promise((resolve, reject) => {
    sftp.rmdir(path, (error) => {
      if (error) {
        reject(error);
      } else {
        resolve();
      }
    });
  });

/** @param {string} relative */
const remotePath = (relative) => {
  if (
    !relative ||
    relative.startsWith('/') ||
    relative.split('/').some((part) => !part || part === '.' || part === '..')
  ) {
    throw new Error(`Unsafe remote path: ${relative}`);
  }
  return posix.join(remoteRoot, relative);
};

/** @param {string} relative */
const isProtectedPath = (relative) => protectedPaths.has(posix.basename(relative));

/** @param {Iterable<string>} values @param {(left: string, right: string) => number} [compare] */
const sortPaths = (values, compare = (left, right) => left.localeCompare(right)) => {
  const copy = [...values];
  // The configured TypeScript lib omits toSorted; the copied array is safe to mutate.
  // oxlint-disable-next-line unicorn/no-array-sort
  return copy.sort(compare);
};

/** @param {unknown} error */
const errorText = (error) => (error instanceof Error ? error.message : String(error));

/** @param {string} host @returns {Promise<Session>} */
const openSession = async (host) => {
  /** @type {Client | undefined} */
  let client;
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

/** @returns {Promise<Session[]>} */
const discoverSessions = async () => {
  const results = await Promise.allSettled(hosts.map(openSession));
  /** @type {Session[]} */
  const sessions = [];
  for (const [index, result] of results.entries()) {
    if (result.status === 'fulfilled') {
      sessions.push(result.value);
      process.stdout.write(`${hosts[index]}: target verified, ${result.value.revision}\n`);
    } else {
      process.stdout.write(`${hosts[index]}: ${errorText(result.reason)}\n`);
    }
  }
  return sessions;
};

/** @param {Session[]} sessions @returns {Promise<Session[]>} */
const verifySharedStorage = async (sessions) => {
  if (sessions.length === 0) {
    throw new Error('No verified SFTP host is available.');
  }
  const primary = sessions[0];
  const sharedPath = remotePath(`.personal-site-share-${randomUUID()}`);
  const sharedToken = randomBytes(shareTokenBytes);
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
        const returnToken = randomBytes(shareTokenBytes);
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
    /** @type {Session[]} */
    const shared = [];
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

/** @returns {Promise<{ files: Map<string, { absolute: string, size: number }>, dirs: Set<string> }>} */
const scanLocal = async () => {
  /** @type {Map<string, { absolute: string, size: number }>} */
  const files = new Map();
  /** @type {Set<string>} */
  const dirs = new Set();
  /** @type {(directory: string, relative: string) => Promise<void>} */
  const visit = async (directory, relative) => {
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
  await visit(siteRoot, '');
  if (!files.has('index.html')) {
    throw new Error('The build is missing index.html.');
  }
  return { dirs, files };
};

/** @param {Sftp} sftp @returns {Promise<{ files: Set<string>, dirs: Set<string> }>} */
const scanRemote = async (sftp) => {
  /** @type {Set<string>} */
  const files = new Set();
  /** @type {Set<string>} */
  const dirs = new Set();
  /** @type {(relative: string) => Promise<void>} */
  const visit = async (relative) => {
    const entries = await listRemote(sftp, relative ? remotePath(relative) : remoteRoot);
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

/** @param {Promise<void>[]} tasks */
const settleAll = async (tasks) => {
  const results = await Promise.allSettled(tasks);
  const failure = results.find((result) => result.status === 'rejected');
  if (failure?.status === 'rejected') {
    throw failure.reason instanceof Error ? failure.reason : new Error(String(failure.reason));
  }
};

/** @param {Session} session @param {string[]} items @param {(session: Session, item: string) => Promise<void>} action */
const runBucket = async (session, items, action) => {
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
  await settleAll(Array.from({ length: Math.min(perHostConcurrency, items.length) }, next));
};

/** @param {Session[]} sessions @param {string[]} items @param {(session: Session, item: string) => Promise<void>} action */
const runDistributed = async (sessions, items, action) => {
  /** @type {string[][]} */
  const buckets = sessions.map(() => []);
  for (const [index, item] of items.entries()) {
    buckets[index % sessions.length].push(item);
  }
  await settleAll(sessions.map((session, index) => runBucket(session, buckets[index], action)));
};

/** @param {Session[]} sessions @param {Awaited<ReturnType<typeof scanLocal>>} local */
const syncSite = async (sessions, local) => {
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

/** @param {string} expected @param {number} remaining */
const verifyPublic = async (expected, remaining) => {
  const revision = process.env.GITHUB_SHA;
  const url = `https://people.arcada.fi/~bergenwb/deployment.json?rev=${revision}`;
  const actual = await fetch(url, {
    headers: { 'Cache-Control': 'no-cache' },
    signal: AbortSignal.timeout(publicRequestTimeoutMs),
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
    setTimeout(resolve, publicCheckDelayMs);
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
  /** @type {Session[]} */
  let sessions = [];
  /** @type {string | undefined} */
  let receipt;
  try {
    sessions = await discoverSessions();
    if (process.argv.includes('--probe')) {
      process.stdout.write(`${sessions.length} of ${hosts.length} SFTP targets verified.\n`);
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
    await verifyPublic(receipt, publicCheckAttempts);
  }
}
