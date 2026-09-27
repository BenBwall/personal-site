import adapter from '@sveltejs/adapter-static';
import type { Config } from '@sveltejs/kit';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';
import { z } from 'zod';

import { optimizeStaticOutput } from '#scripts/optimize-static-output.ts';

const basePathSchema = z.union([z.literal(''), z.templateLiteral(['/', z.string()])]);
const basePath = basePathSchema.safeParse(process.env.BASE_PATH ?? '');
if (!basePath.success) {
  throw new Error('BASE_PATH must begin with a slash.');
}

const config: Config = {
  kit: {
    adapter: optimizeStaticOutput(
      adapter({
        assets: 'dist',
        pages: 'dist',
      }),
      'dist',
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
    // These small stylesheets are cheaper to include in the first response.
    inlineStyleThreshold: 20_000,
    paths: {
      base: basePath.data,
    },
  },
  preprocess: vitePreprocess(),
};

export default config;
