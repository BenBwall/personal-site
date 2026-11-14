import { randomBytes, randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { posix, resolve as resolvePath } from 'node:path';
import { fileURLToPath } from 'node:url';

import type { Client, SFTPWrapper } from 'ssh2';

import {
  DOMUS_HOSTS,
  DOMUS_HTML,
  DOMUS_PUBLIC_URL,
  WHACK_A_MOLE_DIRECTORY,
  connect,
  errorText,
  openSftp,
  readRemote,
  remotePathIn,
  removeRemoteFile,
  sortPaths,
  verifyPublic,
  writeRemote,
} from '#scripts/domus-sftp.ts';
import {
  type LocalSite,
  checkConflicts,
  makeMissingDirs,
  printPlan,
  removeDirs,
  requireRevision,
  scanLocalSite,
  scanRemoteSite,
  writeReceipt,
} from '#scripts/domus-sync.ts';

const REMOTE_ROOT = DOMUS_HTML;
const HOSTS = DOMUS_HOSTS;

const SHARE_TOKEN_BYTES = 32;
const SITE_ROOT = resolvePath(
  process.env.DOMUS_SITE_DIR ?? fileURLToPath(new URL('../site/', import.meta.url)),
);
const PROTECTED_PATHS = new Set([
  '.htaccess',
  '.personal-site-deploy-target',
  'deployment.json',
] as const);
// Top-level directories of `html` that other repositories publish. This publisher never
// lists, changes or removes anything inside them, and the build may not contain them.
const EXTERNAL_SITES: ReadonlySet<string> = new Set([WHACK_A_MOLE_DIRECTORY]);

type ProtectedPath = typeof PROTECTED_PATHS extends ReadonlySet<infer T> ? T : never;

type Session = Readonly<{ host: string; client: Client; sftp: SFTPWrapper; revision: string }>;

const expectedMarker = await readFile(
  fileURLToPath(new URL('../.github/domus-deploy-target', import.meta.url)),
);
const remotePath = (relative: string): string => remotePathIn(REMOTE_ROOT, relative);

const isProtectedPath = (relative: string): boolean =>
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion
  PROTECTED_PATHS.has(posix.basename(relative) as ProtectedPath);

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

const scanLocal = (): Promise<LocalSite> =>
  scanLocalSite(SITE_ROOT, (relative, isFile) => {
    if (EXTERNAL_SITES.has(relative)) {
      return "The build contains another site's directory";
    }
    if (isFile && isProtectedPath(relative)) {
      return 'The build contains a reserved deployment file';
    }
    return null;
  });

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
  await settleAll(Array.from({ length: Math.min(3, items.length) }, next));
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
  const remote = await scanRemoteSite(primary.sftp, REMOTE_ROOT, EXTERNAL_SITES);
  if (!remote.files.has('.htaccess') || !remote.files.has('.personal-site-deploy-target')) {
    throw new Error('The remote site is missing a protected target file.');
  }
  checkConflicts(local, remote);
  await makeMissingDirs(primary.sftp, REMOTE_ROOT, local, remote);

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
  const staleDirs = [...remote.dirs].filter(
    (relative) =>
      !local.dirs.has(relative) &&
      ![...remote.files].some((file) => isProtectedPath(file) && file.startsWith(`${relative}/`)),
  );
  await removeDirs(primary.sftp, REMOTE_ROOT, staleDirs);

  const actualIndex = await readRemote(primary.sftp, remotePath('index.html'));
  if (!actualIndex.equals(indexContent)) {
    throw new Error('The remote homepage differs from the build.');
  }
  const revision = requireRevision('GITHUB_SHA');
  const receipt = await writeReceipt(primary.sftp, remotePath('deployment.json'), revision);
  process.stdout.write(
    `Published ${revision} through ${sessions.map((session) => session.host).join(', ')}.\n`,
  );
  return receipt;
};

if (process.argv.includes('--plan')) {
  printPlan(await scanLocal());
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
    const revision = process.env.GITHUB_SHA;
    await verifyPublic(`${DOMUS_PUBLIC_URL}deployment.json?rev=${revision}`, receipt);
    process.stdout.write(`The public site serves ${revision}.\n`);
  }
}
