// Publishes a build of https://github.com/it-26-sv/whac-a-mole-bergenwb to
// html/whack-a-mole on Domus, served at https://people.arcada.fi/~bergenwb/whack-a-mole/.
// See DEPLOYMENT.md. Only that directory is ever read or changed.
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
  isMissing,
  listRemote,
  makeRemoteDir,
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

const REMOTE_ROOT = posix.join(DOMUS_HTML, WHACK_A_MOLE_DIRECTORY);
const PUBLIC_URL = `${DOMUS_PUBLIC_URL}${WHACK_A_MOLE_DIRECTORY}/`;
const MARKER = '.whack-a-mole-deploy-target';
const RECEIPT = 'deployment.json';
// Kept on the server between deployments; the build may not contain them.
const RESERVED_PATHS: ReadonlySet<string> = new Set([MARKER, RECEIPT]);
const SITE_ROOT = resolvePath(
  process.env.WHACK_A_MOLE_SITE_DIR ??
    fileURLToPath(new URL('../whack-a-mole-site/', import.meta.url)),
);

type Session = Readonly<{ host: string; client: Client; sftp: SFTPWrapper }>;

const expectedMarker = await readFile(
  fileURLToPath(new URL('../.github/whack-a-mole-deploy-target', import.meta.url)),
);
const remotePath = (relative: string): string => remotePathIn(REMOTE_ROOT, relative);

// Resolves to whether the target directory exists, or rejects for any other failure.
const targetExists = (sftp: SFTPWrapper): Promise<boolean> =>
  listRemote(sftp, REMOTE_ROOT).then(
    () => true,
    (error: unknown) => {
      if (isMissing(error)) {
        return false;
      }
      throw error;
    },
  );

// The target must carry the expected marker. On the first deployment the directory
// doesn't exist yet: create it with the marker. Never touch a directory without one.
const checkTarget = async (sftp: SFTPWrapper): Promise<void> => {
  if (!(await targetExists(sftp))) {
    await makeRemoteDir(sftp, REMOTE_ROOT);
    await writeRemote(sftp, remotePath(MARKER), expectedMarker);
    process.stdout.write(`Created ${REMOTE_ROOT} with its target marker.\n`);
    return;
  }
  const marker = await readRemote(sftp, remotePath(MARKER)).catch((error: unknown) => {
    if (isMissing(error)) {
      throw new Error(`${REMOTE_ROOT} exists without a target marker`, { cause: error });
    }
    throw error;
  });
  if (!marker.equals(expectedMarker)) {
    throw new Error('target marker differs');
  }
};

const openSession = async (host: string): Promise<Session> => {
  let client: Client | undefined;
  try {
    client = await connect(host);
    const sftp = await openSftp(client);
    await checkTarget(sftp);
    return { client, host, sftp };
  } catch (error) {
    client?.end();
    throw error;
  }
};

// The hosts share one home directory, so the first one that works is enough.
const firstSession = async (hosts: readonly string[]): Promise<Session> => {
  const [host, ...rest] = hosts;
  if (!host) {
    throw new Error('No verified SFTP host is available.');
  }
  try {
    const session = await openSession(host);
    process.stdout.write(`${host}: target verified.\n`);
    return session;
  } catch (error) {
    process.stdout.write(`${host}: ${errorText(error)}\n`);
    return firstSession(rest);
  }
};

const scanLocal = (): Promise<LocalSite> =>
  scanLocalSite(SITE_ROOT, (relative) =>
    RESERVED_PATHS.has(relative) ? 'The build contains a reserved deployment file' : null,
  );

const upload = async (sftp: SFTPWrapper, local: LocalSite, relative: string): Promise<void> => {
  const file = local.files.get(relative);
  if (!file) {
    throw new Error(`Missing local build file: ${relative}`);
  }
  await writeRemote(sftp, remotePath(relative), await readFile(file.absolute));
};

// Uploads the build, then removes what it no longer has. index.html goes last, so
// visitors never get a page whose assets haven't arrived yet.
const syncSite = async (sftp: SFTPWrapper, local: LocalSite): Promise<void> => {
  const remote = await scanRemoteSite(sftp, REMOTE_ROOT);
  checkConflicts(local, remote);
  await makeMissingDirs(sftp, REMOTE_ROOT, local, remote);
  const contentFiles = sortPaths([...local.files.keys()].filter((file) => file !== 'index.html'));
  process.stdout.write(`Uploading ${local.files.size} files.\n`);
  await Promise.all(contentFiles.map((relative) => upload(sftp, local, relative)));
  await upload(sftp, local, 'index.html');

  const staleFiles = [...remote.files].filter(
    (file) => !local.files.has(file) && !RESERVED_PATHS.has(file),
  );
  process.stdout.write(`Removing ${staleFiles.length} stale files.\n`);
  await Promise.all(staleFiles.map((relative) => removeRemoteFile(sftp, remotePath(relative))));
  await removeDirs(
    sftp,
    REMOTE_ROOT,
    [...remote.dirs].filter((dir) => !local.dirs.has(dir)),
  );
};

const publish = async (revision: string): Promise<string> => {
  const local = await scanLocal();
  const session = await firstSession(DOMUS_HOSTS);
  try {
    await syncSite(session.sftp, local);
    const receipt = await writeReceipt(session.sftp, remotePath(RECEIPT), revision);
    process.stdout.write(`Published ${revision} through ${session.host}.\n`);
    return receipt;
  } finally {
    session.client.end();
  }
};

if (process.argv.includes('--plan')) {
  printPlan(await scanLocal());
} else {
  // The whack-a-mole commit that was built, recorded in deployment.json.
  const revision = requireRevision('WHACK_A_MOLE_REVISION');
  const receipt = await publish(revision);
  await verifyPublic(`${PUBLIC_URL}${RECEIPT}?rev=${revision}`, receipt);
  process.stdout.write(`${PUBLIC_URL} serves ${revision}.\n`);
}
