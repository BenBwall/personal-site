import { mkdir, readdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import sharp from 'sharp';

const sourceDirectory = fileURLToPath(new URL('./source-images/gallery/', import.meta.url));
const generatedDirectory = fileURLToPath(
  new URL('../static/images/generated/gallery/', import.meta.url),
);
const thumbnailWidths = [80, 160, 240, 320, 480, 640];
const viewerWidths = [270, 540, 810, 1080, 1536];

export const generateGallery = async () => {
  const photos = (await readdir(sourceDirectory)).filter((name) => name.endsWith('.jpeg'));
  await mkdir(generatedDirectory, { recursive: true });
  await Promise.all(
    photos.map(async (name) => {
      const id = name.slice(0, -'.jpeg'.length);
      const image = sharp(join(sourceDirectory, name)).autoOrient();
      await Promise.all([
        ...thumbnailWidths.map((width) =>
          image
            .clone()
            .resize({ width, withoutEnlargement: true })
            .webp({ quality: 80 })
            .toFile(join(generatedDirectory, `${id}-thumbnail-${width}.webp`)),
        ),
        ...viewerWidths.map((width) =>
          image
            .clone()
            .resize({ width, withoutEnlargement: true })
            .webp({ quality: 85 })
            .toFile(join(generatedDirectory, `${id}-full-${width}.webp`)),
        ),
        // A responsive document keeps high-density images fitted inside the named iframe.
        writeFile(
          join(generatedDirectory, `${id}.html`),
          `<!doctype html>
<html lang="sv-FI">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta http-equiv="content-security-policy" content="default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; script-src 'self'; base-uri 'none'; object-src 'none'">
  <title>Bild från sitzen</title>
  <style>html,body{margin:0;height:100%;}img{display:block;width:100%;height:100%;object-fit:contain;}</style>
</head>
<body>
  <img src="${id}-full-270.webp" srcset="${viewerWidths.map((width) => `${id}-full-${width}.webp ${width}w`).join(', ')}" sizes="100vw" width="270" height="360" alt="Foto från när jag klädde upp mig inför en sitz.">
</body>
</html>
`,
        ),
      ]);
    }),
  );
};
