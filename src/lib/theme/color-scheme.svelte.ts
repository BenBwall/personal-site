import { on } from 'svelte/events';

type ColorScheme = 'light' | 'dark';

const isColorScheme = (value: unknown): value is ColorScheme =>
  value === 'light' || value === 'dark';

const isColorSchemeOrNull = (value: unknown): value is ColorScheme | null =>
  value === null || isColorScheme(value);

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
    const storedScheme = window.localStorage.getItem('color-scheme');
    if (isColorScheme(storedScheme)) {
      return storedScheme;
    }
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
    if (
      e.key === 'color-scheme' &&
      e.storageArea === window.localStorage &&
      isColorSchemeOrNull(e.newValue)
    ) {
      updateColorScheme(e.newValue);
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
