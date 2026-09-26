<script lang="ts">
  import CheckboxInput from '$inputs/CheckboxInput.svelte';
  import IntegerInput from '$inputs/IntegerInput.svelte';
  import Details from '$lib/components/Details.svelte';
  import { maxRainbowIntervalMs } from '$lib/theme/theme';

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

<div class="rainbow-settings">
  <Details title={`Rainbow ${channel} settings`}>
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
  </Details>
</div>

<style>
  .rainbow-settings {
    margin: 0 0.5rem 0.75rem;
  }
</style>
