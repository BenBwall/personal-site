import { initializeColorScheme } from '$lib/theme/color-scheme.svelte';
import { initializePreferences } from '$lib/theme/preferences.svelte';
import { applyTheme, getCurrentTheme } from '$lib/theme/theme';
import type { ClientInit } from '@sveltejs/kit';

export const init: ClientInit = () => {
  applyTheme(getCurrentTheme());
  const cleanupColorScheme = initializeColorScheme();
  const cleanupPreferences = initializePreferences();

  if (import.meta.hot) {
    import.meta.hot.dispose(() => {
      cleanupColorScheme();
      cleanupPreferences();
    });
  }
};
