import source from '$lib/theme/favicon.svg?raw';
import { on } from 'svelte/events';

const colorVariable = /var\((--[\w-]+)\)/g;
const animationIntervalMs = 100;

/** Resolve the live CSS palette inside the standalone favicon image. */
export const initializeFavicon = (): (() => void) | undefined => {
  const link = document.getElementById('site-favicon');
  if (!(link instanceof HTMLLinkElement)) {
    return undefined;
  }

  const root = document.documentElement;
  const fallback = link.href;
  const probes = document.createElement('div');
  probes.hidden = true;
  const colors = new Map(
    [...source.matchAll(colorVariable)].map((match) => [match[1], document.createElement('span')]),
  );
  for (const [name, probe] of colors) {
    probe.style.color = `var(${name})`;
    probes.append(probe);
  }
  document.body.append(probes);

  let timer: number | undefined;
  let previousSvg = '';
  const update = () => {
    window.clearTimeout(timer);
    if (document.hidden) {
      return;
    }

    // Resolving color on an element also evaluates relative OKLCH colors and calc().
    const palette = new Map(
      [...colors].map(([name, probe]) => [name, getComputedStyle(probe).color]),
    );
    const svg = source.replace(
      colorVariable,
      (match: string, name: string) => palette.get(name) ?? match,
    );
    if (svg !== previousSvg) {
      link.href = `data:image/svg+xml,${encodeURIComponent(svg)}`;
      previousSvg = svg;
    }

    // CSS animations do not trigger mutation observers. Sample only while they run.
    if (root.getAnimations().some((animation) => animation.playState === 'running')) {
      timer = window.setTimeout(update, animationIntervalMs);
    }
  };

  const observer = new MutationObserver(update);
  observer.observe(root, {
    attributeFilter: [
      'style',
      'data-rainbow-hue',
      'data-rainbow-luminosity',
      'data-rainbow-chroma',
      'data-reduced-motion',
    ],
    attributes: true,
  });
  const unsubscribeVisibility = on(document, 'visibilitychange', update);
  update();

  return () => {
    observer.disconnect();
    unsubscribeVisibility();
    window.clearTimeout(timer);
    probes.remove();
    link.href = fallback;
  };
};
