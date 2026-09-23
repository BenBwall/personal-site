import { readFile, readdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { minify } from 'vite';

/**
 * Minify copied static scripts before the adapter writes and compresses them.
 * @param {import('@sveltejs/kit').Adapter} adapter
 * @returns {import('@sveltejs/kit').Adapter}
 */
export const minifyStaticJs = (adapter) => ({
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
  },
});
