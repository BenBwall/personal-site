(() => {
  try {
    const scheme = localStorage.getItem('color-scheme');
    if (scheme === 'light' || scheme === 'dark') {
      document.documentElement.style.colorScheme = scheme;
    }
  } catch {}

  let reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  try {
    const saved: unknown = JSON.parse(localStorage.getItem('appearance-preferences') ?? '{}');
    if (typeof saved === 'object' && saved !== null) {
      if ('reducedMotion' in saved && typeof saved.reducedMotion === 'boolean') {
        reducedMotion = saved.reducedMotion;
      }
    }
  } catch {}
  document.documentElement.dataset.reducedMotion = String(reducedMotion);

  try {
    const theme: unknown = JSON.parse(localStorage.getItem('theme') ?? 'null');
    if (typeof theme !== 'object' || theme === null) {
      return;
    }
    if (
      'luminosity' in theme &&
      typeof theme.luminosity === 'number' &&
      Number.isFinite(theme.luminosity) &&
      theme.luminosity >= 0 &&
      theme.luminosity <= 1
    ) {
      document.documentElement.style.setProperty('--theme-luminosity', String(theme.luminosity));
    }
    if (
      'chroma' in theme &&
      typeof theme.chroma === 'number' &&
      Number.isFinite(theme.chroma) &&
      theme.chroma >= 0 &&
      theme.chroma <= 0.5
    ) {
      document.documentElement.style.setProperty('--theme-chroma', String(theme.chroma));
    }
    if (
      'hue' in theme &&
      typeof theme.hue === 'number' &&
      Number.isInteger(theme.hue) &&
      theme.hue >= 0 &&
      theme.hue <= 360
    ) {
      document.documentElement.style.setProperty('--theme-hue', String(theme.hue));
    }
  } catch {}
})();
