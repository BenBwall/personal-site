import { z } from '$lib/validation';

export const fullHueRotation = 360;
export const maxChroma = 0.5;
export const maxRainbowIntervalMs = 2_147_483_647;

const defaultChroma = 0.14;
const defaultHue = 250;
const defaultLuminosity = 0.6;
const defaultRainbowIntervalMs = 100;

const themeSchema = z.object({
  chroma: z.number().min(0).max(maxChroma).default(defaultChroma),
  hue: z.int().min(0).max(fullHueRotation).default(defaultHue),
  luminosity: z.number().min(0).max(1).default(defaultLuminosity),
  rainbowEnabled: z.boolean().default(false),
  rainbowIncrement: z
    .int()
    .min(1)
    .max(fullHueRotation - 1)
    .default(1),
  rainbowIntervalMs: z.int().min(1).max(maxRainbowIntervalMs).default(defaultRainbowIntervalMs),
});

export type Theme = z.infer<typeof themeSchema>;

export const defaultTheme: Readonly<Theme> = themeSchema.parse({});

export const applyTheme = (theme: Theme) => {
  const root = document.documentElement;
  const rainbowDuration = (fullHueRotation / theme.rainbowIncrement) * theme.rainbowIntervalMs;

  root.style.setProperty('--theme-luminosity', String(theme.luminosity));
  root.style.setProperty('--theme-chroma', String(theme.chroma));
  root.style.setProperty('--theme-hue', String(theme.hue));
  root.style.setProperty('--rainbow-duration', `${rainbowDuration}ms`);
  root.toggleAttribute('data-rainbow', theme.rainbowEnabled);
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
