import { mkdir, readdir } from 'node:fs/promises';
import { join, parse } from 'node:path';
import { fileURLToPath } from 'node:url';

import sharp from 'sharp';

const sourceDirectory = fileURLToPath(new URL('./source-images/', import.meta.url));
const generatedDirectory = fileURLToPath(new URL('../static/images/generated/', import.meta.url));
const smallWidth = 320;
const mediumWidth = 480;
const largeWidth = 640;
const extraLargeWidth = 960;
const widths = [smallWidth, mediumWidth, largeWidth, extraLargeWidth];
const avifQuality = 50;
const webpQuality = 80;
export const generateImages = async () => {
  const originals = (await readdir(sourceDirectory, { withFileTypes: true })).filter(
    (entry) => entry.isFile() && /\.(jpe?g|png)$/i.test(entry.name),
  );

  await mkdir(generatedDirectory, { recursive: true });
  await Promise.all(
    originals.flatMap((original) =>
      widths.map(async (width) => {
        const image = sharp(join(sourceDirectory, original.name))
          .autoOrient()
          .resize({ width, withoutEnlargement: true });
        const output = join(generatedDirectory, `${parse(original.name).name}-${width}`);

        await Promise.all([
          image.clone().avif({ quality: avifQuality }).toFile(`${output}.avif`),
          image.webp({ quality: webpQuality }).toFile(`${output}.webp`),
        ]);
      }),
    ),
  );

  process.stdout.write(`Generated AVIF and WebP variants for ${originals.length} images.\n`);
};
