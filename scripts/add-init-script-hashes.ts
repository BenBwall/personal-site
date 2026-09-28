import { createHash } from 'node:crypto';

/** Match HTML newline handling and keep script contents inside their element. */
export const prepareInlineInitScript = (source: string): string =>
  source.replace(/\r\n?/g, '\n').replace(/<\//g, '<\\/');

/** Add every generated init script to the static page's accepted script hashes. */
export const addInitScriptHashes = (html: string, scripts: Iterable<string>): string => {
  const hashes = new Set(
    [...scripts].map(
      (source) =>
        `'sha256-${createHash('sha256').update(prepareInlineInitScript(source)).digest('base64')}'`,
    ),
  );
  if (hashes.size === 0) {
    return html;
  }

  const csp =
    /(<meta http-equiv="content-security-policy" content="[^"]*?\bscript-src)(?=\s|;|")([^";]*)/i;
  if (!csp.test(html)) {
    throw new Error('Cannot authorize inline init scripts: missing script-src CSP.');
  }
  return html.replace(csp, (_match: string, prefix: string, sources: string) => {
    const accepted = new Set(sources.trim().split(/\s+/));
    const missing = [...hashes].filter((hash) => !accepted.has(hash));
    return `${prefix}${sources}${missing.length ? ` ${missing.join(' ')}` : ''}`;
  });
};
