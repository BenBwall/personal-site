/** Convert live theme variables to the hex colors required by canvas-confetti. */
export const readThemeColors = (names: readonly string[]): string[] => {
  const canvas = document.createElement('canvas');
  canvas.width = 1;
  canvas.height = 1;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) {
    throw new Error('Cannot read theme colors without a canvas context.');
  }
  const style = getComputedStyle(document.documentElement);
  return names.map((name) => {
    const color = style.getPropertyValue(name).trim();
    if (!color || !CSS.supports('color', color)) {
      throw new Error(`Invalid theme color: ${name}`);
    }
    context.clearRect(0, 0, 1, 1);
    context.fillStyle = color;
    context.fillRect(0, 0, 1, 1);
    const channels = context.getImageData(0, 0, 1, 1).data.slice(0, 3);
    return `#${Array.from(channels, (channel) => channel.toString(16).padStart(2, '0')).join('')}`;
  });
};
