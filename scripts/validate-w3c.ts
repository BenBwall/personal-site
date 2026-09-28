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

const cssErrorWhitelist = [/:Invalid number$/i, /:Unrecognized at-rule(?:\s.*)?$/i];

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
    const stdout = result.error ? '' : result.stdout;
    const stderr = result.error ? '' : result.stderr;
    // GNU CSS warnings have a space-prefixed context; all other output must be checked.
    const cssErrors =
      kind === 'css'
        ? stdout
            .split(/\r?\n/)
            .filter((line) => line.trim() && !/^file:.*:\d+: (?:.* - )? :/.test(line))
        : [];
    const ignoredCssErrors = cssErrors.filter((line) =>
      cssErrorWhitelist.some((pattern) => pattern.test(line)),
    );
    const blockingCssErrors = cssErrors.filter(
      (line) => !cssErrorWhitelist.some((pattern) => pattern.test(line)),
    );
    // The CSS validator prints its option map to stderr even on successful runs.
    const unexpectedCssStderr = stderr
      .replace(/^\{[^\r\n]*\boutput=gnu\b[^\r\n]*\}\r?$/gm, '')
      .trim();
    const passed =
      !result.error &&
      result.signal === null &&
      result.status !== null &&
      (kind === 'css'
        ? blockingCssErrors.length === 0 &&
          unexpectedCssStderr.length === 0 &&
          (result.status === 0 || ignoredCssErrors.length > 0)
        : result.status === 0);
    const status = `${kind.toUpperCase()}: ${passed ? 'passed' : 'failed'} (exit ${result.status ?? 'unavailable'})`;
    const whitelistSummary =
      ignoredCssErrors.length > 0
        ? `Ignored ${ignoredCssErrors.length} whitelisted CSS errors.\n`
        : '';
    const diagnostics = result.error
      ? `${result.error.message}\nEnsure Java 17 or newer is installed and on PATH.\n`
      : `${stdout}${stderr}`;
    const output = `${status}\n${whitelistSummary}Source: ${validators[kind].url}\nDirectory: ${directory}\n\n${diagnostics}`;
    await writeFile(report, output);
    console.log(`${status}. Report: ${report}`);
    if (whitelistSummary) {
      console.log(whitelistSummary.trim());
    }
    if (!passed) {
      const failureDiagnostics =
        kind === 'css' && !result.error
          ? [...blockingCssErrors, unexpectedCssStderr].join('\n')
          : diagnostics;
      console.log(failureDiagnostics.split('\n').slice(0, 20).join('\n'));
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
