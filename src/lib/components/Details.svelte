<script lang="ts">
  import { ChevronDown } from '@lucide/svelte';
  import type { Snippet } from 'svelte';

  type Props = {
    title: string;
    open?: boolean;
    children: Snippet;
  };

  let { title, open = $bindable(false), children }: Props = $props();
</script>

<details bind:open>
  <summary>
    {title}
    <span class="chevron" aria-hidden="true"><ChevronDown size={16} /></span>
  </summary>
  {@render children()}
</details>

<style>
  details {
    overflow: clip;
    border: 1px solid var(--theme-border-color);
    border-radius: 0.5rem;
    background: light-dark(var(--color-50), var(--color-950));
  }

  summary {
    display: flex;
    align-items: center;
    justify-content: space-between;
    min-height: 2.75rem;
    box-sizing: border-box;
    padding: 0.625rem 0.875rem;
    border-block-end: 1px solid transparent;
    background: light-dark(var(--color-100), var(--color-900));
    font-size: 0.875rem;
    font-weight: 600;
    list-style: none;
    cursor: pointer;
  }

  summary::-webkit-details-marker {
    display: none;
  }

  .chevron {
    display: inline-flex;
    flex: 0 0 auto;
    margin-inline: 0.25rem;
    transition: transform 180ms ease;
  }

  details[open] summary {
    border-block-end-color: var(--theme-border-color);
  }

  details[open] .chevron {
    transform: rotate(180deg);
  }

  summary:hover,
  summary:focus-visible {
    background: light-dark(var(--color-200), var(--color-800));
    color: light-dark(var(--color-950), var(--color-50));
  }

  summary:focus-visible {
    outline: 2px solid light-dark(var(--color-600), var(--color-400));
    outline-offset: -2px;
  }

  @media (prefers-reduced-motion: reduce) {
    .chevron {
      transition: none;
    }
  }
</style>
