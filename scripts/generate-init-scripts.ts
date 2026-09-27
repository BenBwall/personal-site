import { mkdir, readdir, writeFile } from 'node:fs/promises';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

import { build } from 'vite';

const sourceDirectory = fileURLToPath(new URL('../src', import.meta.url));
const outputDirectory = fileURLToPath(new URL('../static/init', import.meta.url));

const generateInitScript = async (file: string): Promise<void> => {
  const sourcePath = join(sourceDirectory, file);
  const outputPath = join(outputDirectory, file.replace(/\.init\.ts$/, '.js'));
  const result = await build({
    build: {
      copyPublicDir: false,
      lib: { entry: sourcePath, formats: ['iife'], name: 'InitScript' },
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
    throw new Error(`Failed to bundle init script: ${file}`);
  }
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, chunk.code);
};

/** Bundle all .init.ts files under src before Vite copies the static directory. */
export const generateInitScripts = async (): Promise<void> => {
  const files = await readdir(sourceDirectory, { recursive: true, withFileTypes: true });
  const scripts = files
    .filter((file) => file.isFile() && file.name.endsWith('.init.ts'))
    .map((file) => relative(sourceDirectory, join(file.parentPath, file.name)));
  await Promise.all(scripts.map(generateInitScript));
};
