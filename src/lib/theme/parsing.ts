export const fullHueRotation = 360;
export const maxChroma = 0.5;

export type ColorScheme = 'light' | 'dark';
export type Preferences = { reducedMotion: boolean };
type ThemeChannels = { chroma: number; hue: number; luminosity: number };

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** Read a supported color scheme, returning null for an absent or invalid preference. */
export const parseColorScheme = (value: unknown): ColorScheme | null =>
  value === 'light' || value === 'dark' ? value : null;

/** Read saved appearance overrides without treating invalid values as user choices. */
export const parsePreferences = (value: unknown): Partial<Preferences> =>
  isRecord(value) && typeof value.reducedMotion === 'boolean'
    ? { reducedMotion: value.reducedMotion }
    : {};

/** Check a finite theme channel's range and, when required, its integer value. */
export const isValidThemeChannel = (
  value: unknown,
  maximum: number,
  integer = false,
): value is number =>
  typeof value === 'number' &&
  Number.isFinite(value) &&
  value >= 0 &&
  value <= maximum &&
  (!integer || Number.isInteger(value));

/** Read valid saved theme channels independently, omitting absent or invalid channels. */
export const parseThemeChannels = (value: unknown): Partial<ThemeChannels> => {
  if (!isRecord(value)) {
    return {};
  }
  const channels: Partial<ThemeChannels> = {};
  if (isValidThemeChannel(value.chroma, maxChroma)) {
    channels.chroma = value.chroma;
  }
  if (isValidThemeChannel(value.hue, fullHueRotation, true)) {
    channels.hue = value.hue;
  }
  if (isValidThemeChannel(value.luminosity, 1)) {
    channels.luminosity = value.luminosity;
  }
  return channels;
};
