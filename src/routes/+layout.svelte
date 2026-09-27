<script lang="ts">
  import { asset, resolve } from '$app/paths';
  import { page } from '$app/state';
  import type { RouteId } from '$app/types';
  import AppearanceMenu from '$lib/components/AppearanceMenu.svelte';
  import { initializeFavicon } from '$lib/theme/favicon';
  import defaultFavicon from '$lib/theme/favicon-default.svg?raw';

  import '$lib/theme/theme.css';
  import { type Snippet, onMount } from 'svelte';

  type Page = {
    label: string;
    route: RouteId;
  };

  let { children }: { children: Snippet } = $props();

  const pages = [
    { label: 'Home', route: '/' },
    { label: 'Projects', route: '/projects' },
    { label: 'Resume', route: '/resume' },
  ] as const satisfies readonly Page[];

  onMount(initializeFavicon);

  const initialFavicon = `data:image/svg+xml,${encodeURIComponent(defaultFavicon)}`;
</script>

<svelte:head>
  <link id="site-favicon" rel="icon" type="image/svg+xml" href={initialFavicon} />
  <script src={asset('/init/lib/theme/theme.js')}></script>
</svelte:head>

<div class="layout">
  <header>
    <nav aria-label="Primary navigation">
      <div class="nav-links">
        {#each pages as { label, route } (route)}
          <a
            href={resolve(route === '/' ? route : `${route}/`)}
            aria-current={page.route.id === route ? 'page' : undefined}
          >
            {label}
          </a>
        {/each}
      </div>
      <AppearanceMenu />
    </nav>
  </header>

  <main>
    {@render children()}
  </main>
</div>

<style>
  :global(html) {
    color-scheme: light dark;
    color: light-dark(var(--color-700), var(--color-300));
    background-color: light-dark(var(--color-complement-50), var(--color-complement-950));
  }

  .layout {
    display: grid;
    min-height: 100vh;
    grid-template-columns: minmax(0, 1fr);
    grid-template-rows: auto 1fr auto;
  }

  header,
  main {
    width: min(100% - 2rem, 70rem);
    margin-inline: auto;
  }

  header {
    padding-block: 1.25rem;
  }

  nav {
    display: flex;
    gap: 0.25rem;
    font-family: system-ui, sans-serif;
    font-size: 0.875rem;
    font-weight: 500;
    line-height: 1.25;
  }

  .nav-links {
    display: flex;
    gap: 0.25rem;
    border-bottom: 1px solid var(--theme-border-color);
  }

  nav a {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-height: 2.75rem;
    box-sizing: border-box;
    padding: 0.625rem 1rem;
    border-bottom: 2px solid transparent;
    color: light-dark(var(--color-700), var(--color-200));
    text-decoration: none;
    white-space: nowrap;
  }

  nav a:hover {
    background-color: light-dark(var(--color-100), var(--color-900));
    color: light-dark(var(--color-950), var(--color-50));
  }

  nav a:focus-visible {
    outline: 2px solid light-dark(var(--color-600), var(--color-300));
    outline-offset: 3px;
  }

  nav a[aria-current='page'] {
    color: light-dark(var(--color-950), var(--color-50));
    border-bottom-color: light-dark(var(--color-600), var(--color-300));
  }

  @media (max-width: 30rem) {
    .nav-links {
      flex: 1;
    }

    nav a {
      flex: 1;
      padding-inline: 0.25rem;
      font-size: 0.8125rem;
    }
  }

  main {
    padding-block: 2rem;
  }
</style>
