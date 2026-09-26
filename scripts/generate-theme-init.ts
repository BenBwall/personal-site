import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

import { build } from 'vite';

const sourcePath = fileURLToPath(new URL('../src/lib/theme/theme-init.ts', import.meta.url));
const outputPath = fileURLToPath(new URL('../static/theme-init.js', import.meta.url));

/** Bundle the early browser script and its shared parsers before Vite copies the static directory. */
export const generateThemeInit = async (): Promise<void> => {
  const result = await build({
    build: {
      copyPublicDir: false,
      lib: { entry: sourcePath, formats: ['iife'], name: 'ThemeInit' },
      minify: false,
      target: 'es2020',
      write: false,
    },
    configFile: false,
    logLevel: 'silent',
    mode: process.env.NODE_ENV ?? 'production',
    resolve: {
      alias: { $lib: fileURLToPath(new URL('../src/lib', import.meta.url)) },
    },
  });
  const outputs = Array.isArray(result) ? result : [result];
  const chunk = outputs
    .flatMap((output) => ('output' in output ? output.output : []))
    .find((output) => output.type === 'chunk');
  if (!chunk) {
    throw new Error('Failed to bundle the early theme script.');
  }
  await writeFile(outputPath, chunk.code);
};
