import type { AssetPath } from '$app/types';

type GeneratedAssetPath = `images/generated/${string}` | `init/${string}`;

/** Type a file that the build writes to `static` after SvelteKit generates its asset types. */
export const generatedAssetPath = (file: GeneratedAssetPath): AssetPath =>
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- Generated files are missing from AssetPath during type checks.
  file as AssetPath;
