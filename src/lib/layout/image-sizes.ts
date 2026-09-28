// Image sizes resolve rem against the browser's initial font size, so reproduce
// the root's screen scale from +layout.svelte rather than using a bare rem value.
const displayUnit =
  'clamp(1rem, calc(1rem + min((100vw - 1920px) / 160, (100vh - 1080px) / 90)), 4rem)';

export const photoSizes = `min(calc((100vw - 2.75 * ${displayUnit}) / 2 - 2px), calc(15.625 * ${displayUnit} - 2px))`;
export const previewSizes = `min(calc(100vw - 2 * ${displayUnit}), calc(36 * ${displayUnit}))`;
export const thumbnailSizes = `calc(5 * ${displayUnit})`;
