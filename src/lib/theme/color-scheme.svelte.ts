import { type ColorScheme, parseColorScheme } from '$lib/theme/parsing';
import { on } from 'svelte/events';

export const colorScheme = $state<{ current: ColorScheme }>({
  current: 'light',
});

let preference: ColorScheme | undefined;

const applyColorScheme = (scheme: ColorScheme) => {
  colorScheme.current = scheme;
  document.documentElement.style.colorScheme = scheme;
};

const readColorSchemeFromStorage = () => {
  try {
    return parseColorScheme(window.localStorage.getItem('color-scheme'));
  } catch {}
  return null;
};

export const initializeColorScheme = (): (() => void) => {
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)');
  const updateColorScheme = (newValue: ColorScheme | null = readColorSchemeFromStorage()) => {
    applyColorScheme(newValue ?? (prefersDark.matches ? 'dark' : 'light'));
  };

  updateColorScheme();
  const unsubscribeMedia = on(prefersDark, 'change', () => {
    updateColorScheme();
  });
  const unsubscribeStorage = on(window, 'storage', (e) => {
    if (e.key === 'color-scheme' && e.storageArea === window.localStorage) {
      const scheme = parseColorScheme(e.newValue);
      if (scheme !== null || e.newValue === null) {
        updateColorScheme(scheme);
      }
    }
  });
  return () => {
    unsubscribeMedia();
    unsubscribeStorage();
  };
};

export const toggleColorScheme = () => {
  preference = colorScheme.current === 'dark' ? 'light' : 'dark';
  applyColorScheme(preference);

  try {
    window.localStorage.setItem('color-scheme', preference);
  } catch {
    // Keep the manual choice for this session even if it cannot be saved.
  }
};
