import { on } from 'svelte/events';

import { type Preferences, parsePreferences } from '#lib/theme/parsing.js';

const storageKey = 'appearance-preferences';
const reducedMotionQuery = '(prefers-reduced-motion: reduce)';

export type { Preferences } from '#lib/theme/parsing.js';

export const preferences = $state<Preferences>({
  reducedMotion: false,
});

const matches = (query: string) => window.matchMedia(query).matches;
let overrides: Partial<Preferences> = {};

const readOverrides = (): Partial<Preferences> => {
  try {
    const saved: unknown = JSON.parse(localStorage.getItem(storageKey) ?? '{}');
    return parsePreferences(saved);
  } catch {
    return {};
  }
};

const applyPreferences = () => {
  preferences.reducedMotion = overrides.reducedMotion ?? matches(reducedMotionQuery);
  const value = String(preferences.reducedMotion);
  if (document.documentElement.dataset.reducedMotion !== value) {
    document.documentElement.dataset.reducedMotion = value;
  }
};

export const setPreference = <Key extends keyof Preferences>(key: Key, value: Preferences[Key]) => {
  overrides = { ...overrides, [key]: value };
  applyPreferences();
  try {
    localStorage.setItem(storageKey, JSON.stringify(overrides));
  } catch {
    // Keep the choice for this session if storage is unavailable.
  }
};

export const initializePreferences = (): (() => void) => {
  overrides = readOverrides();
  applyPreferences();
  const subscriptions = [on(window.matchMedia(reducedMotionQuery), 'change', applyPreferences)];
  subscriptions.push(
    on(window, 'storage', (event) => {
      if (event.key === storageKey || event.key === null) {
        overrides = readOverrides();
        applyPreferences();
      }
    }),
  );
  return () => {
    for (const unsubscribe of subscriptions) {
      unsubscribe();
    }
  };
};
