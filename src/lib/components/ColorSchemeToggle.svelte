<script lang="ts">
  import { colorScheme, toggleColorScheme } from '$lib/theme/color-scheme.svelte';
  import { Moon, Sun } from '@lucide/svelte';

  const isDark = $derived(colorScheme.current === 'dark');
</script>

<button
  type="button"
  aria-label="Dark mode"
  aria-pressed={isDark}
  title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
  onclick={toggleColorScheme}
>
  <span class="icon sun" aria-hidden="true">
    <Sun size={20} />
  </span>
  <span class="icon moon" aria-hidden="true">
    <Moon size={20} />
  </span>
</button>

<style>
  button {
    position: relative;
    flex: 0 0 auto;
    width: 2.75rem;
    height: 2.75rem;
    margin-inline-start: auto;
    padding: 0;
    overflow: hidden;
    border: 0;
    background: transparent;
    color: light-dark(var(--color-700), var(--color-200));
    cursor: pointer;
  }

  button:hover {
    background-color: light-dark(var(--color-100), var(--color-900));
    color: light-dark(var(--color-950), var(--color-50));
  }

  button:focus-visible {
    outline: 2px solid light-dark(var(--color-600), var(--color-300));
    outline-offset: 3px;
  }

  .icon {
    position: absolute;
    inset: 0;
    display: grid;
    place-items: center;
    pointer-events: none;
    transition:
      color 500ms ease,
      transform 500ms ease;
  }

  .sun {
    color: light-dark(currentColor, transparent);
  }

  .moon {
    color: light-dark(transparent, currentColor);
    transform: rotate(90deg);
  }

  button[aria-pressed='true'] .sun {
    transform: rotate(-90deg);
  }

  button[aria-pressed='true'] .moon {
    transform: rotate(0deg);
  }

  button[aria-pressed='false']:hover .sun {
    transform: rotate(12deg);
  }

  button[aria-pressed='true']:hover .moon {
    transform: rotate(-12deg);
  }

  :global(:root[data-reduced-motion='true']) button[aria-pressed] .icon {
    transition: none;
    transform: none;
  }

  @media (prefers-reduced-motion: reduce) {
    :global(:root:not([data-reduced-motion='false'])) button[aria-pressed] .icon {
      transition: none;
      transform: none;
    }
  }
</style>
