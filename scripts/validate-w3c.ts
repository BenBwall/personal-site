import { spawnSync } from 'node:child_process';
import { access, mkdir, readdir, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const validators = {
  css: {
    jar: 'css-validator-20250226.jar',
    url: 'https://github.com/w3c/css-validator/releases/download/cssval-20250226/css-validator.jar',
  },
  html: {
    jar: 'vnu.jar',
    url: 'https://github.com/validator/validator/releases/download/latest/vnu.jar',
  },
};

const selection = process.argv[2] ?? 'all';
if (!['all', 'html', 'css'].includes(selection)) {
  throw new Error('Usage: bun scripts/validate-w3c.ts [all|html|css] [directory=dist]');
}

const directory = resolve(process.argv[3] ?? 'dist');
const files = (await readdir(directory, { recursive: true })).toSorted();
const htmlFiles = files.filter((file) => file.endsWith('.html'));
const cssFiles = files.filter((file) => file.endsWith('.css'));
if (htmlFiles.length === 0) {
  throw new Error(`No built HTML found in ${directory}. Run bun run build first.`);
}

const cache = resolve('node_modules/.cache/w3c');
const reports = resolve('w3c-reports');
await mkdir(cache, { recursive: true });
await mkdir(reports, { recursive: true });

const download = async (kind: keyof typeof validators): Promise<string> => {
  const validator = validators[kind];
  const jar = join(cache, validator.jar);
  try {
    await access(jar);
    return jar;
  } catch {
    console.log(`Downloading ${validator.url}`);
  }
  const response = await fetch(validator.url, { signal: AbortSignal.timeout(60_000) });
  if (!response.ok) {
    throw new Error(`Validator download failed: HTTP ${response.status} (${validator.url})`);
  }
  await writeFile(jar, new Uint8Array(await response.arrayBuffer()));
  return jar;
};

const validate = async (kind: keyof typeof validators): Promise<boolean> => {
  const report = join(reports, `${kind}.txt`);
  try {
    const jar = await download(kind);
    const options =
      kind === 'html'
        ? [
            '--errors-only',
            '--format',
            'gnu',
            // The separate W3C CSS Validator checks inline and external CSS.
            '--filterpattern',
            '(?s)^CSS:.*',
            ...htmlFiles.map((file) => join(directory, file)),
          ]
        : [
            '--profile=css3svg',
            '--output=gnu',
            '--lang=en',
            '--vextwarning=true',
            // HTML input covers <style> blocks and style attributes too.
            ...[...htmlFiles, ...cssFiles].map((file) => pathToFileURL(join(directory, file)).href),
          ];
    const result = spawnSync('java', ['-jar', jar, ...options], {
      encoding: 'utf8',
      maxBuffer: 16 * 1024 * 1024,
      timeout: 120_000,
      windowsHide: true,
    });
    const passed = !result.error && result.status === 0;
    const status = `${kind.toUpperCase()}: ${passed ? 'passed' : 'failed'} (exit ${result.status ?? 'unavailable'})`;
    const diagnostics = result.error
      ? `${result.error.message}\nEnsure Java 17 or newer is installed and on PATH.\n`
      : `${result.stdout}${result.stderr}`;
    const output = `${status}\nSource: ${validators[kind].url}\nDirectory: ${directory}\n\n${diagnostics}`;
    await writeFile(report, output);
    console.log(`${status}. Report: ${report}`);
    if (!passed) {
      console.log(diagnostics.split('\n').slice(0, 20).join('\n'));
    }
    return passed;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await writeFile(report, `${kind.toUpperCase()}: failed\n${message}\n`);
    console.error(message);
    return false;
  }
};

console.log(`Validating ${htmlFiles.length} HTML files and ${cssFiles.length} stylesheets.`);
let passed = true;
if (selection === 'all' || selection === 'html') {
  passed = (await validate('html')) && passed;
}
if (selection === 'all' || selection === 'css') {
  passed = (await validate('css')) && passed;
}
process.exitCode = passed ? 0 : 1;
