import { timingSafeEqual } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { posix } from 'node:path';
import { fileURLToPath } from 'node:url';

import { Client } from 'ssh2';

const sshPort = 22;
const readyTimeoutMs = 10_000;
const remoteRoot = '/home/b/bergenwb/html';
const hosts = ['penti.arcada.fi', 'xena.arcada.fi', 'gabrielle.arcada.fi'];
const username = process.env.ARCADA_USERNAME;
const password = process.env.ARCADA_PASSWORD;

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

/** @param {string} host */
const probe = async (host) => {
  /** @type {Client | undefined} */
  let client;
  try {
    client = await connect(host);
    const sftp = await openSftp(client);
    const actualMarker = await readRemote(
      sftp,
      posix.join(remoteRoot, '.personal-site-deploy-target'),
    );
    if (!actualMarker.equals(expectedMarker)) {
      throw new Error('target marker differs');
    }
    const revision = await readRemote(sftp, posix.join(remoteRoot, 'deployment.json'));
    process.stdout.write(`${host}: target verified, ${revision.toString('utf8').trim()}\n`);
    return true;
  } catch (error) {
    process.stdout.write(`${host}: ${error instanceof Error ? error.message : String(error)}\n`);
    return false;
  } finally {
    client?.end();
  }
};

if (!process.argv.includes('--probe')) {
  throw new Error('Only --probe is implemented so far.');
}

const results = await Promise.all(hosts.map(probe));
process.stdout.write(
  `${results.filter(Boolean).length} of ${hosts.length} SFTP targets verified.\n`,
);
