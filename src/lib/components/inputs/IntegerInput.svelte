<script lang="ts">
  import InputField from '$inputs/InputField.svelte';
  import { z } from '$lib/validation';
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
    maxErrorMessage?: string;
    preserveInvalidDraft?: boolean;
    showValidationError?: boolean;
    onValueChange?: (value: number) => void;
  };

  let {
    label,
    value = $bindable(0),
    min = 0,
    max = Number.MAX_SAFE_INTEGER,
    maxErrorMessage,
    preserveInvalidDraft = false,
    showValidationError = false,
    onValueChange,
    'aria-describedby': describedBy,
    onblur,
    ...attributes
  }: Props = $props();
  const inputId = $props.id();
  let inputElement: HTMLInputElement | undefined;
  let error = $state('');

  const valueSchema = $derived(
    z
      .int({ error: 'Enter a whole number.' })
      .min(min, { error: `Enter a number from ${min} to ${max}.` })
      .max(max, { error: maxErrorMessage ?? `Enter a number from ${min} to ${max}.` }),
  );

  const update = (input: HTMLInputElement) => {
    if (input.validity.valueMissing) {
      error = `${label} is required.`;
      return;
    }
    if (input.validity.patternMismatch) {
      error = 'Enter a whole number.';
      return;
    }

    const result = valueSchema.safeParse(Number(input.value));
    if (!result.success) {
      error = result.error.issues[0].message;
      return;
    }

    error = '';
    value = result.data;
    onValueChange?.(value);
  };

  $effect(() => {
    if (!inputElement) {
      return;
    }
    if (error || !valueSchema.safeParse(Number(inputElement.value)).success) {
      update(inputElement);
    }
  });
</script>

<div class="integer-field">
  <InputField {label}>
    <input
      bind:this={inputElement}
      {...attributes}
      type="text"
      inputmode="numeric"
      pattern="[0-9]*"
      {value}
      aria-invalid={error !== ''}
      aria-describedby={[describedBy, showValidationError && error ? `${inputId}-error` : undefined]
        .filter(Boolean)
        .join(' ') || undefined}
      oninput={(event) => update(event.currentTarget)}
      onblur={(event) => {
        if (!preserveInvalidDraft || !error) {
          event.currentTarget.value = String(value);
          error = '';
        }
        onblur?.(event);
      }}
    />
  </InputField>
  {#if showValidationError && error}
    <p id={`${inputId}-error`} class="validation-error" role="alert">{error}</p>
  {/if}
</div>

<style>
  .validation-error {
    margin: 0;
    padding: 0 1rem 0.5rem;
    color: light-dark(var(--color-offset-120-700), var(--color-offset-120-300));
    font-size: 0.8125rem;
    line-height: 1.4;
  }

  .integer-field :global(input[aria-invalid='true']) {
    border-bottom-color: light-dark(var(--color-offset-120-700), var(--color-offset-120-300));
  }
</style>
