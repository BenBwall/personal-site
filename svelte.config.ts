import adapter from '@sveltejs/adapter-static';
import type { Config } from '@sveltejs/kit';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

import { minifyStaticJs } from '#scripts/minify-static-js.ts';

const isBasePath = (value: string): value is '' | `/${string}` =>
  value === '' || value.startsWith('/');
const basePath = process.env.BASE_PATH ?? '';
if (!isBasePath(basePath)) {
  throw new Error('BASE_PATH must begin with a slash.');
}

const config: Config = {
  kit: {
    adapter: minifyStaticJs(
      adapter({
        assets: 'dist',
        pages: 'dist',
        precompress: true,
      }),
    ),
    alias: {
      '$/*': './src/*',
      '$components/*': './src/lib/components/*',
      '$inputs/*': './src/lib/components/inputs/*',
      '$theme/*': './src/lib/theme/*',
      '$typography/*': './src/lib/components/typography/*',
    },
    csp: {
      directives: {
        'base-uri': ['self'],
        'object-src': ['none'],
        'script-src': ['self'],
      },
      mode: 'hash',
    },
    paths: {
      base: basePath,
    },
  },
  preprocess: vitePreprocess(),
};

export default config;
