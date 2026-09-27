import { readFile } from 'node:fs/promises';

import { transform } from 'lightningcss';

const themeSource = new URL('../src/lib/theme/theme.css', import.meta.url);

/** Resolve the stylesheet's default palette for assets that cannot use CSS variables. */
export const readThemeColors = async (): Promise<(name: string) => string> => {
  const css = await readFile(themeSource, 'utf8');
  const root = /:root\s*\{([^}]+)\}/.exec(css)?.[1];
  if (!root) {
    throw new Error('The theme stylesheet is missing its root palette.');
  }
  const properties = new Map(
    [...root.matchAll(/(--[\w-]+):\s*([^;]+);/g)].map((match) => [match[1], match[2].trim()]),
  );
  for (const match of css.matchAll(/@property\s+(--[\w-]+)\s*\{([^}]+)\}/g)) {
    const initial = /initial-value:\s*([^;]+);/.exec(match[2])?.[1];
    if (initial && !properties.has(match[1])) {
      properties.set(match[1], initial.trim());
    }
  }
  const resolve = (name: string, ancestors: string[] = []): string => {
    const value = properties.get(name);
    if (!value || ancestors.includes(name)) {
      throw new Error(`Missing or circular theme variable: ${name}`);
    }
    return value.replace(/var\((--[\w-]+)\)/g, (_match: string, dependency: string) =>
      resolve(dependency, [...ancestors, name]),
    );
  };
  return (name) => {
    const result = transform({
      code: Buffer.from(`.color { color: ${resolve(name)}; }`),
      filename: 'theme-color.css',
      // Request an sRGB fallback for PDFKit and standalone image renderers.
      targets: { ie: 11 << 16 },
    });
    const color = /color:\s*(#[\da-f]{3,8})\s*;/.exec(result.code.toString())?.[1];
    if (!color) {
      throw new Error(`Could not convert theme variable to sRGB: ${name}`);
    }
    return color;
  };
};
