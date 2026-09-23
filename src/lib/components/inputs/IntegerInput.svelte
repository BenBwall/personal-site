<script lang="ts">
  import InputField from '$inputs/InputField.svelte';
  import type { HTMLInputAttributes } from 'svelte/elements';

  // Validates non-negative integers; invalid drafts never update the bound value.
  type Props = Omit<
    HTMLInputAttributes,
    'type' | 'value' | 'min' | 'max' | 'step' | 'inputmode' | 'pattern' | 'aria-invalid' | 'oninput'
  > & {
    label: string;
    value?: number;
    min?: number;
    max?: number;
    onValueChange?: (value: number) => void;
  };

  let {
    label,
    value = $bindable(0),
    min = 0,
    max = Number.MAX_SAFE_INTEGER,
    onValueChange,
    onblur,
    ...attributes
  }: Props = $props();
  let invalid = $state(false);

  const update = (input: HTMLInputElement) => {
    invalid = !input.validity.valid;
    if (invalid) {
      return;
    }

    const next = Number(input.value);
    invalid = !Number.isSafeInteger(next) || next < min || next > max;
    if (!invalid) {
      value = next;
      onValueChange?.(value);
    }
  };
</script>

<InputField {label}>
  <input
    {...attributes}
    type="text"
    inputmode="numeric"
    pattern="[0-9]*"
    {value}
    aria-invalid={invalid}
    oninput={(event) => update(event.currentTarget)}
    onblur={(event) => {
      event.currentTarget.value = String(value);
      invalid = false;
      onblur?.(event);
    }}
  />
</InputField>
