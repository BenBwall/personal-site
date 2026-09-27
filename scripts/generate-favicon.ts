import { readFile, writeFile } from 'node:fs/promises';

import { readThemeColors } from '#scripts/theme-colors.ts';

const source = new URL('../src/lib/theme/favicon.svg', import.meta.url);
const output = new URL('../static/favicon.svg', import.meta.url);
const defaultOutput = new URL('../src/lib/theme/favicon-default.svg', import.meta.url);

/** Generate the standalone favicon using the same palette as the site. */
export const generateFavicon = async (): Promise<void> => {
  const [svg, color] = await Promise.all([readFile(source, 'utf8'), readThemeColors()]);
  const themed = svg.replace(/var\((--[\w-]+)\)/g, (_match: string, name: string) => color(name));
  const generated = `<!-- Generated from the favicon source and theme.css. -->\n${themed}`;
  await Promise.all([writeFile(output, generated), writeFile(defaultOutput, generated)]);
};
