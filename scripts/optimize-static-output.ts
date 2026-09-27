import { createHash } from 'node:crypto';
import { readFile, readdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import type { Adapter } from '@sveltejs/kit';
import { minify } from 'vite';

/** Inline first-paint scripts and authorize their exact contents in the static CSP. */
export const inlineInitScripts = (html: string, scripts: ReadonlyMap<string, string>): string => {
  const hashes = new Set<string>();
  const result = html.replace(
    /<script src="[^"]*\/init\/([^"]+)"><\/script>/g,
    (_tag: string, name: string) => {
      const source = scripts.get(name);
      if (source === undefined) {
        throw new Error(`Missing init script: ${name}`);
      }
      // Escape HTML closing tags before hashing the actual script content.
      const code = source.replace(/<\//g, '<\\/');
      hashes.add(`'sha256-${createHash('sha256').update(code).digest('base64')}'`);
      return `<script>${code}</script>`;
    },
  );
  if (hashes.size === 0) {
    return result;
  }
  const csp = /(<meta http-equiv="content-security-policy" content="[^"]*script-src)([^";]*)/i;
  if (!csp.test(result)) {
    throw new Error('Cannot authorize inline init scripts: missing script-src CSP.');
  }
  return result.replace(csp, `$1$2 ${[...hashes].join(' ')}`);
};

/** Minify static scripts, inline first-paint code, then compress the final output. */
export const optimizeStaticOutput = (adapter: Adapter, directory: string): Adapter => ({
  ...adapter,
  async adapt(builder) {
    const files = await readdir('static', { recursive: true });
    const scripts = files.filter((file) => /\.(?:js|mjs|cjs)$/.test(file));
    await Promise.all(
      scripts.map(async (file) => {
        const output = join(builder.getClientDirectory(), file);
        const source = await readFile(output, 'utf8');
        // Classic scripts may expose globals; preserve their top-level bindings.
        const result = await minify(file, source, { module: file.endsWith('.mjs') });
        if (result.errors.length) {
          throw new Error(`Failed to minify ${file}: ${JSON.stringify(result.errors)}`);
        }
        await writeFile(output, result.code);
      }),
    );
    await adapter.adapt(builder);
    const initFiles = await readdir(join(directory, 'init'), { recursive: true });
    const initScripts = new Map(
      await Promise.all(
        initFiles
          .filter((file) => file.endsWith('.js'))
          .map(async (file): Promise<[string, string]> => [
            file.replaceAll('\\', '/'),
            await readFile(join(directory, 'init', file), 'utf8'),
          ]),
      ),
    );
    const pages = (await readdir(directory, { recursive: true })).filter((file) =>
      file.endsWith('.html'),
    );
    await Promise.all(
      pages.map(async (file) => {
        const path = join(directory, file);
        await writeFile(path, inlineInitScripts(await readFile(path, 'utf8'), initScripts));
      }),
    );
    await builder.compress(directory);
  },
});
