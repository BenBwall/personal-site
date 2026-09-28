import { mkdir, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import sharp from 'sharp';

const sourceDirectory = fileURLToPath(new URL('./source-images/gallery/', import.meta.url));
const generatedDirectory = fileURLToPath(
  new URL('../static/images/generated/gallery/', import.meta.url),
);
export const generateGallery = async () => {
  const photos = (await readdir(sourceDirectory)).filter((name) => name.endsWith('.jpeg'));
  await mkdir(generatedDirectory, { recursive: true });
  await Promise.all(
    photos.map(async (name) => {
      const id = name.slice(0, -'.jpeg'.length);
      const image = sharp(join(sourceDirectory, name)).autoOrient();
      await Promise.all([
        image
          .clone()
          .resize({ width: 80, withoutEnlargement: true })
          .webp({ quality: 80 })
          .toFile(join(generatedDirectory, `${id}-thumbnail.webp`)),
        image
          .clone()
          .resize({ width: 270, withoutEnlargement: true })
          .webp({ quality: 85 })
          .toFile(join(generatedDirectory, `${id}-full.webp`)),
      ]);
    }),
  );
};
