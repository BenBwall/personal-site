# Images

Keep the original JPEG or PNG images in this directory. A Vite plugin generates
images at the start of `bun dev` and Vite builds.
Svelte checks and preview do not generate images. Restart the dev server after
changing an original image.

The script writes AVIF (quality 50) and WebP (quality 80) variants to `static/images/generated/`
at widths of 320, 480, 640, and 960 pixels. It applies the original orientation,
preserves the aspect ratio, and avoids enlarging smaller images.

The site uses the files in `static/images/generated/`, which is ignored by Git.
Commit the original images and the generation script.
