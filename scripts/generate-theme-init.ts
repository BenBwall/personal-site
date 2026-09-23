import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

import { ModuleKind, ScriptTarget, transpileModule } from 'typescript';

const sourcePath = fileURLToPath(new URL('../src/lib/theme/theme-init.ts', import.meta.url));
const outputPath = fileURLToPath(new URL('../static/theme-init.js', import.meta.url));

/** Compile the early browser script before Vite copies the static directory. */
export const generateThemeInit = async (): Promise<void> => {
  const source = await readFile(sourcePath, 'utf8');
  const result = transpileModule(source, {
    compilerOptions: {
      module: ModuleKind.ESNext,
      removeComments: true,
      target: ScriptTarget.ES2020,
    },
    fileName: sourcePath,
    reportDiagnostics: true,
  });
  if (result.diagnostics?.length) {
    throw new Error('Failed to compile the early theme script.');
  }
  await writeFile(outputPath, result.outputText);
};
