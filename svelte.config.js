import adapter from '@sveltejs/adapter-static';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

import { minifyStaticJs } from '#scripts/minify-static-js.js';

/** @type {import('@sveltejs/kit').Config} */
const config = {
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
      base: process.env.BASE_PATH ?? '',
    },
  },
  preprocess: vitePreprocess(),
};

export default config;
