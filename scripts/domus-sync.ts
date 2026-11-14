// Comparing a local build with a directory on Domus, shared by the publishers in this folder.
import { readdir, stat } from 'node:fs/promises';
import { posix, resolve as resolvePath } from 'node:path';

import type { SFTPWrapper } from 'ssh2';

import {
  byDepth,
  listRemote,
  makeRemoteDir,
  remotePathIn,
  removeRemoteDir,
  sortPaths,
  writeRemote,
} from '#scripts/domus-sftp.ts';

export type LocalSite = Readonly<{
  files: ReadonlyMap<string, Readonly<{ absolute: string; size: number }>>;
  dirs: ReadonlySet<string>;
}>;
export type RemoteSite = Readonly<{ files: ReadonlySet<string>; dirs: ReadonlySet<string> }>;

// Returns why the build entry at `relative` may not be published, or null if it may.
type EntryCheck = (relative: string, isFile: boolean) => string | null;

// Lists the build in `root`. It must contain index.html and nothing but files and
// directories, and `check` must accept every entry.
export const scanLocalSite = async (root: string, check: EntryCheck): Promise<LocalSite> => {
  const files = new Map<string, { absolute: string; size: number }>();
  const dirs = new Set<string>();
  const visit = async (directory: string, relative: string): Promise<void> => {
    const entries = await readdir(directory, { withFileTypes: true });
    await Promise.all(
      entries.map(async (entry) => {
        const nextRelative = posix.join(relative, entry.name);
        const absolute = resolvePath(directory, entry.name);
        remotePathIn('/', nextRelative);
        if (entry.isSymbolicLink()) {
          throw new Error(`The build contains a symbolic link: ${nextRelative}`);
        }
        const problem = check(nextRelative, entry.isFile());
        if (problem) {
          throw new Error(`${problem}: ${nextRelative}`);
        }
        if (entry.isDirectory()) {
          dirs.add(nextRelative);
          await visit(absolute, nextRelative);
        } else if (entry.isFile()) {
          files.set(nextRelative, { absolute, size: (await stat(absolute)).size });
        } else {
          throw new Error(`The build contains an unsupported entry: ${nextRelative}`);
        }
      }),
    );
  };
  await visit(root, '');
  if (!files.has('index.html')) {
    throw new Error('The build is missing index.html.');
  }
  return { dirs, files };
};

// Lists the remote directory `root`, leaving out the top-level entries named in `skip`.
export const scanRemoteSite = async (
  sftp: SFTPWrapper,
  root: string,
  skip: ReadonlySet<string> = new Set(),
): Promise<RemoteSite> => {
  const files = new Set<string>();
  const dirs = new Set<string>();
  const visit = async (relative: string): Promise<void> => {
    const entries = await listRemote(sftp, relative ? remotePathIn(root, relative) : root);
    await Promise.all(
      entries.map(async ({ filename: name, attrs }) => {
        if (name === '.' || name === '..' || (!relative && skip.has(name))) {
          return;
        }
        if (!name || name.includes('/') || name.includes('\\')) {
          throw new Error(`Unsafe name in remote listing: ${name}`);
        }
        const nextRelative = posix.join(relative, name);
        remotePathIn(root, nextRelative);
        if (attrs.isSymbolicLink()) {
          throw new Error(`Remote site contains a symbolic link: ${nextRelative}`);
        }
        if (attrs.isDirectory()) {
          dirs.add(nextRelative);
          await visit(nextRelative);
        } else if (attrs.isFile()) {
          files.add(nextRelative);
        } else {
          throw new Error(`Remote site contains an unsupported entry: ${nextRelative}`);
        }
      }),
    );
  };
  await visit('');
  return { dirs, files };
};

// Throws if a remote file stands where the build has a directory, or the other way round.
export const checkConflicts = (local: LocalSite, remote: RemoteSite): void => {
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
};

// Creates the build's directories that `root` lacks, parents first.
export const makeMissingDirs = (
  sftp: SFTPWrapper,
  root: string,
  local: LocalSite,
  remote: RemoteSite,
): Promise<void> =>
  sortPaths(
    [...local.dirs].filter((relative) => !remote.dirs.has(relative)),
    byDepth,
  ).reduce(
    (previous, relative) => previous.then(() => makeRemoteDir(sftp, remotePathIn(root, relative))),
    Promise.resolve(),
  );

// Removes these (empty) directories of `root`, children first.
export const removeDirs = (
  sftp: SFTPWrapper,
  root: string,
  dirs: Iterable<string>,
): Promise<void> =>
  sortPaths(dirs, (left, right) => byDepth(right, left)).reduce(
    (previous, relative) =>
      previous.then(() => removeRemoteDir(sftp, remotePathIn(root, relative))),
    Promise.resolve(),
  );

// Prints the size of the build, for a dry run with --plan.
export const printPlan = (local: LocalSite): void => {
  const bytes = [...local.files.values()].reduce((total, file) => total + file.size, 0);
  process.stdout.write(
    `Build: ${local.files.size} files, ${local.dirs.size} directories, ${bytes} bytes.\n`,
  );
};

// The full commit SHA in the environment variable `name`.
export const requireRevision = (name: string): string => {
  const revision = process.env[name] ?? '';
  if (!/^[a-f0-9]{40}$/.test(revision)) {
    throw new Error(`${name} must be a full commit SHA.`);
  }
  return revision;
};

// Writes the deployment receipt, which records the published commit, to `path` and
// returns its text.
export const writeReceipt = async (
  sftp: SFTPWrapper,
  path: string,
  revision: string,
): Promise<string> => {
  const receipt = Buffer.from(`${JSON.stringify({ revision })}\n`);
  await writeRemote(sftp, path, receipt);
  return receipt.toString('utf8').trim();
};
