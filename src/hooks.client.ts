import type { ClientInit } from '@sveltejs/kit/hooks';

import { initializeColorScheme } from '#lib/theme/color-scheme.svelte.js';
import { initializePreferences } from '#lib/theme/preferences.svelte.js';
import { applyTheme, getCurrentTheme } from '#lib/theme/theme.js';

export const init: ClientInit = async () => {
  const theme = getCurrentTheme();
  // Static colors were restored by the head script before the first paint.
  if (theme.rainbowEnabled || theme.rainbowLuminosityEnabled || theme.rainbowChromaEnabled) {
    applyTheme(theme);
  }
  const cleanupColorScheme = initializeColorScheme();
  const cleanupPreferences = initializePreferences();

  // Finish painting the restored theme before SvelteKit reads initial scroll positions.
  await new Promise<void>((resolve) => {
    window.requestAnimationFrame(() =>
      window.requestAnimationFrame(() => {
        resolve();
      }),
    );
  });

  if (import.meta.hot) {
    import.meta.hot.dispose(() => {
      cleanupColorScheme();
      cleanupPreferences();
    });
  }
};
