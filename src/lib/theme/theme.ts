import { z } from '$lib/validation';

export const fullHueRotation = 360;
export const maxChroma = 0.5;
export const maxRainbowIntervalMs = 2_147_483_647;

const themeSchema = z.object({
  chroma: z.number().min(0).max(maxChroma).default(0.14),
  hue: z.int().min(0).max(fullHueRotation).default(250),
  luminosity: z.number().min(0).max(1).default(0.6),
  rainbowChromaEnabled: z.boolean().default(false),
  rainbowChromaIncrement: z.int().min(1).max(50).default(1),
  rainbowChromaIntervalMs: z.int().min(1).max(maxRainbowIntervalMs).default(100),
  rainbowEnabled: z.boolean().default(false),
  rainbowIncrement: z
    .int()
    .min(1)
    .max(fullHueRotation - 1)
    .default(1),
  rainbowIntervalMs: z.int().min(1).max(maxRainbowIntervalMs).default(100),
  rainbowLuminosityEnabled: z.boolean().default(false),
  rainbowLuminosityIncrement: z.int().min(1).max(100).default(1),
  rainbowLuminosityIntervalMs: z.int().min(1).max(maxRainbowIntervalMs).default(100),
});

export type Theme = z.infer<typeof themeSchema>;

export const defaultTheme: Readonly<Theme> = themeSchema.parse({});

export const applyTheme = (theme: Theme) => {
  const root = document.documentElement;
  const hueDuration = (fullHueRotation / theme.rainbowIncrement) * theme.rainbowIntervalMs;
  const luminosityHalfDuration =
    (100 / theme.rainbowLuminosityIncrement) * theme.rainbowLuminosityIntervalMs;
  const chromaHalfDuration = (50 / theme.rainbowChromaIncrement) * theme.rainbowChromaIntervalMs;

  root.style.setProperty('--theme-luminosity', String(theme.luminosity));
  root.style.setProperty('--theme-chroma', String(theme.chroma));
  root.style.setProperty('--theme-hue', String(theme.hue));
  root.style.setProperty('--rainbow-hue-duration', `${hueDuration}ms`);
  root.style.setProperty('--rainbow-luminosity-duration', `${2 * luminosityHalfDuration}ms`);
  root.style.setProperty(
    '--rainbow-luminosity-delay',
    `${-theme.luminosity * luminosityHalfDuration}ms`,
  );
  root.style.setProperty('--rainbow-chroma-duration', `${2 * chromaHalfDuration}ms`);
  root.style.setProperty(
    '--rainbow-chroma-delay',
    `${-(theme.chroma / maxChroma) * chromaHalfDuration}ms`,
  );
  root.toggleAttribute('data-rainbow-hue', theme.rainbowEnabled);
  root.toggleAttribute('data-rainbow-luminosity', theme.rainbowLuminosityEnabled);
  root.toggleAttribute('data-rainbow-chroma', theme.rainbowChromaEnabled);
};

export const setTheme = (theme: Theme) => {
  applyTheme(theme);
  try {
    window.localStorage.setItem('theme', JSON.stringify(themeSchema.parse(theme)));
  } catch {
    // The theme still applies for this session when storage is unavailable.
  }
};

export const getCurrentTheme = (): Theme => {
  try {
    const savedTheme = window.localStorage.getItem('theme') ?? '';
    return themeSchema.parse(JSON.parse(savedTheme));
  } catch {
    // Return the default theme if anything goes wrong.
    return { ...defaultTheme };
  }
};
