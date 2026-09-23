<script lang="ts">
  import type { Snippet } from 'svelte';

  let {
    label,
    valueLabel,
    stacked = false,
    children,
  }: {
    label: string;
    valueLabel?: string;
    stacked?: boolean;
    children: Snippet;
  } = $props();
</script>

<label class:stacked>
  <span>{label}</span>
  {#if valueLabel !== undefined}<span aria-hidden="true">{valueLabel}</span>{/if}
  {@render children()}
</label>

<style>
  label {
    display: grid;
    grid-template-columns: 1fr auto;
    align-items: center;
    gap: 0.75rem;
    box-sizing: border-box;
    min-height: 2.75rem;
    padding: 0.625rem 1rem;
    accent-color: light-dark(var(--color-600), var(--color-400));
  }

  label:hover,
  label:focus-within {
    background: light-dark(var(--color-100), var(--color-900));
    color: light-dark(var(--color-950), var(--color-50));
  }

  .stacked {
    padding-block: 1rem;
    border-block: 1px solid var(--theme-border-color);
  }

  label:has(:global(:disabled)) {
    opacity: var(--disabled-opacity);
  }

  label :global(input) {
    margin: 0;
  }

  label :global(input:focus-visible) {
    outline: 2px solid light-dark(var(--color-600), var(--color-400));
    outline-offset: 3px;
  }

  label:has(:global(button:enabled)),
  label:has(:global(input:is([type='range'], [type='checkbox']))),
  label :global(input:is([type='range'], [type='checkbox'])) {
    cursor: pointer;
  }

  label:has(:global(input:is([type='text'], [type='number']))) {
    cursor: text;
  }

  label:has(:global(button:disabled)),
  label:has(:global(input:disabled)),
  label :global(input:disabled) {
    cursor: not-allowed;
  }

  label :global(input[type='range']) {
    grid-column: 1 / -1;
    min-height: 1.25rem;
  }

  label :global(input[type='checkbox']) {
    width: 1.125rem;
    height: 1.125rem;
  }

  label :global(input[type='text']:focus-visible) {
    outline: none;
    border-bottom-color: light-dark(var(--color-600), var(--color-400));
  }

  label :global(input[type='text']) {
    box-sizing: border-box;
    width: 5rem;
    padding: 0.5rem;
    border: 0;
    border-bottom: 1px solid light-dark(var(--color-300), var(--color-700));
    border-radius: 0;
    background: transparent;
    color: inherit;
    font: inherit;
    text-align: end;
  }
</style>
