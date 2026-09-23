<script lang="ts">
  import type { HTMLInputAttributes } from 'svelte/elements';
  import InputField from '$inputs/InputField.svelte';

  type Props = Omit<HTMLInputAttributes, 'type' | 'checked' | 'onchange'> & {
    label: string;
    checked?: boolean;
    onCheckedChange?: (checked: boolean) => void;
  };

  let { label, checked = $bindable(false), onCheckedChange, ...attributes }: Props = $props();
</script>

<InputField {label}>
  <input
    {...attributes}
    type="checkbox"
    {checked}
    onchange={(event) => {
      checked = event.currentTarget.checked;
      onCheckedChange?.(checked);
    }}
  />
</InputField>
