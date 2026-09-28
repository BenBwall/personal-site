import { mkdir, readdir } from 'node:fs/promises';
import { join, parse } from 'node:path';
import { fileURLToPath } from 'node:url';

import sharp from 'sharp';

const sourceDirectory = fileURLToPath(new URL('./source-images/', import.meta.url));
const generatedDirectory = fileURLToPath(new URL('../static/images/generated/', import.meta.url));
const widths = [320, 400, 480, 640, 800, 960];
export const generateImages = async () => {
  const originals = (await readdir(sourceDirectory, { withFileTypes: true })).filter(
    (entry) => entry.isFile() && /\.(jpe?g|png)$/i.test(entry.name),
  );

  await mkdir(generatedDirectory, { recursive: true });
  await Promise.all(
    originals.map(async (original) => {
      const source = join(sourceDirectory, original.name);
      const { autoOrient } = await sharp(source).metadata();
      // Include the original's available detail, with truthful srcset width descriptors.
      const outputWidths = [...new Set([...widths, Math.min(autoOrient.width, 1200)])].filter(
        (width) => width <= autoOrient.width,
      );
      await Promise.all(
        outputWidths.map(async (width) => {
          const image = sharp(source).autoOrient().resize({ width, withoutEnlargement: true });
          const output = join(generatedDirectory, `${parse(original.name).name}-${width}`);

          await Promise.all([
            image.clone().avif({ quality: 50 }).toFile(`${output}.avif`),
            image.webp({ quality: 80 }).toFile(`${output}.webp`),
          ]);
        }),
      );
    }),
  );

  process.stdout.write(`Generated AVIF and WebP variants for ${originals.length} images.\n`);
};
