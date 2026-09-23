<script lang="ts">
  import type { HTMLInputAttributes } from 'svelte/elements';
  import InputField from '$inputs/InputField.svelte';

  type Props = Omit<HTMLInputAttributes, 'type' | 'value' | 'oninput'> & {
    label: string;
    value?: number;
    valueLabel?: string;
    onValueChange?: (value: number) => void;
  };

  let { label, value = $bindable(0), valueLabel, onValueChange, ...attributes }: Props = $props();
</script>

<InputField {label} {valueLabel} stacked>
  <input
    {...attributes}
    type="range"
    {value}
    oninput={(event) => {
      value = event.currentTarget.valueAsNumber;
      onValueChange?.(value);
    }}
  />
</InputField>
