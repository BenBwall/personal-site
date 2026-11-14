// SFTP access to the Domus web directory, shared by the publishers in this folder.
// Importing this module requires ARCADA_USERNAME and ARCADA_PASSWORD.
import { timingSafeEqual } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { posix } from 'node:path';
import { fileURLToPath } from 'node:url';

import { Client, type FileEntryWithStats, type SFTPWrapper } from 'ssh2';

export const DOMUS_HTML = '/home/b/bergenwb/html';
export const DOMUS_HOSTS = ['penti.arcada.fi', 'xena.arcada.fi', 'gabrielle.arcada.fi'] as const;
export const DOMUS_PUBLIC_URL = 'https://people.arcada.fi/~bergenwb/';
// The `html` subdirectory that scripts/deploy-whack-a-mole.ts publishes
// https://github.com/it-26-sv/whac-a-mole-bergenwb to, served at /~bergenwb/whack-a-mole/.
export const WHACK_A_MOLE_DIRECTORY = 'whack-a-mole';

const USERNAME = process.env.ARCADA_USERNAME;
const PASSWORD = process.env.ARCADA_PASSWORD;

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
const pinnedKeys = new Map<string, Buffer>(
  knownHosts
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => {
      const [host, , base64] = line.split(/\s+/);
      return [host, Buffer.from(base64, 'base64')];
    }),
);

export const connect = (host: string): Promise<Client> =>
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
      port: 22,
      readyTimeout: 10_000,
      tryKeyboard: true,
      username: USERNAME,
    });
  });

export const openSftp = (client: Client): Promise<SFTPWrapper> =>
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

export const readRemote = (sftp: SFTPWrapper, path: string): Promise<Buffer> =>
  new Promise<Buffer>((resolve, reject) => {
    sftp.readFile(path, (error, data) => {
      if (error) {
        reject(error);
      } else {
        resolve(data);
      }
    });
  });

export const writeRemote = (sftp: SFTPWrapper, path: string, content: Buffer): Promise<void> =>
  new Promise<void>((resolve, reject) => {
    sftp.writeFile(path, content, (error) => {
      if (error) {
        reject(error);
      } else {
        resolve();
      }
    });
  });

export const listRemote = (sftp: SFTPWrapper, path: string): Promise<FileEntryWithStats[]> =>
  new Promise<FileEntryWithStats[]>((resolve, reject) => {
    sftp.readdir(path, (error, entries) => {
      if (error) {
        reject(error);
      } else {
        resolve(entries);
      }
    });
  });

export const makeRemoteDir = (sftp: SFTPWrapper, path: string): Promise<void> =>
  new Promise<void>((resolve, reject) => {
    sftp.mkdir(path, (error) => {
      if (error) {
        reject(error);
      } else {
        resolve();
      }
    });
  });

export const removeRemoteFile = (sftp: SFTPWrapper, path: string): Promise<void> =>
  new Promise<void>((resolve, reject) => {
    sftp.unlink(path, (error) => {
      if (error) {
        reject(error);
      } else {
        resolve();
      }
    });
  });

export const removeRemoteDir = (sftp: SFTPWrapper, path: string): Promise<void> =>
  new Promise<void>((resolve, reject) => {
    sftp.rmdir(path, (error) => {
      if (error) {
        reject(error);
      } else {
        resolve();
      }
    });
  });

// SFTP reports a missing file or directory with status code 2 (SSH_FX_NO_SUCH_FILE).
export const isMissing = (error: unknown): boolean =>
  error instanceof Error && 'code' in error && error.code === 2;

// Joins a relative path onto `root`, refusing anything that could leave it.
export const remotePathIn = (root: string, relative: string): string => {
  if (
    !relative ||
    relative.startsWith('/') ||
    relative.split('/').some((part) => !part || part === '.' || part === '..')
  ) {
    throw new Error(`Unsafe remote path: ${relative}`);
  }
  return posix.join(root, relative);
};

export const sortPaths = (
  values: Iterable<string>,
  compare = (left: string, right: string) => left.localeCompare(right),
): string[] => {
  const copy = [...values];
  // The configured TypeScript lib omits toSorted; the copied array is safe to mutate.
  // oxlint-disable-next-line unicorn/no-array-sort
  return copy.sort(compare);
};

// Parents before children, so directories can be created in order.
export const byDepth = (left: string, right: string): number =>
  left.split('/').length - right.split('/').length || left.localeCompare(right);

export const errorText = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

// Waits until `url` serves `expected`, retrying a few times while caches catch up.
export const verifyPublic = async (
  url: string,
  expected: string,
  remaining = 10,
): Promise<void> => {
  const actual = await fetch(url, {
    headers: { 'Cache-Control': 'no-cache' },
    signal: AbortSignal.timeout(15_000),
  })
    .then((response) => (response.ok ? response.text() : ''))
    .catch(() => '');
  if (actual.trim() === expected) {
    return;
  }
  if (remaining <= 1) {
    throw new Error(`${url} did not serve the deployed revision.`);
  }
  await new Promise((resolve) => {
    setTimeout(resolve, 3_000);
  });
  await verifyPublic(url, expected, remaining - 1);
};
