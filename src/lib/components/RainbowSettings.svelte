<script lang="ts">
  import CheckboxInput from '$inputs/CheckboxInput.svelte';
  import IntegerInput from '$inputs/IntegerInput.svelte';
  import { maxRainbowIntervalMs } from '$lib/theme/theme';
  import { ChevronDown } from '@lucide/svelte';

  type Props = {
    channel: 'luminosity' | 'chroma' | 'hue';
    incrementLabel: string;
    incrementMax: number;
    incrementTitle: string;
    enabled: boolean;
    increment: number;
    intervalMs: number;
    onChange: () => void;
  };

  let {
    channel,
    incrementLabel,
    incrementMax,
    incrementTitle,
    enabled = $bindable(false),
    increment = $bindable(1),
    intervalMs = $bindable(100),
    onChange,
  }: Props = $props();
</script>

<details>
  <summary>
    Rainbow {channel} settings
    <span class="chevron" aria-hidden="true"><ChevronDown size={16} /></span>
  </summary>
  <CheckboxInput label={`Rainbow ${channel}`} bind:checked={enabled} onCheckedChange={onChange} />
  <IntegerInput
    label={incrementLabel}
    min={1}
    max={incrementMax}
    required
    title={incrementTitle}
    bind:value={increment}
    onValueChange={onChange}
  />
  <IntegerInput
    label="Interval (ms)"
    min={1}
    max={maxRainbowIntervalMs}
    required
    title="1–2,147,483,647 milliseconds"
    bind:value={intervalMs}
    onValueChange={onChange}
  />
</details>

<style>
  details {
    margin: 0 0.5rem 0.75rem;
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
</style>
