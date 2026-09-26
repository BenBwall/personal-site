import { parseColorScheme, parsePreferences, parseThemeChannels } from '$lib/theme/parsing';

const readThemeInitSaved = (key: string): unknown => {
  try {
    return JSON.parse(localStorage.getItem(key) ?? 'null');
  } catch {
    return null;
  }
};

(() => {
  try {
    const scheme = parseColorScheme(localStorage.getItem('color-scheme'));
    if (scheme !== null) {
      document.documentElement.style.colorScheme = scheme;
    }
  } catch {}

  const savedPreferences = parsePreferences(readThemeInitSaved('appearance-preferences'));
  const reducedMotion =
    savedPreferences.reducedMotion ?? matchMedia('(prefers-reduced-motion: reduce)').matches;
  document.documentElement.dataset.reducedMotion = String(reducedMotion);

  const theme = parseThemeChannels(readThemeInitSaved('theme'));
  if (theme.luminosity !== undefined) {
    document.documentElement.style.setProperty('--theme-luminosity', String(theme.luminosity));
  }
  if (theme.chroma !== undefined) {
    document.documentElement.style.setProperty('--theme-chroma', String(theme.chroma));
  }
  if (theme.hue !== undefined) {
    document.documentElement.style.setProperty('--theme-hue', String(theme.hue));
  }
})();
