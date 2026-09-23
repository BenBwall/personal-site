<script lang="ts">
  import type { Snippet } from 'svelte';
  import type { HTMLAttributes } from 'svelte/elements';
  import type { TextElement, TextVariant, TypographyTone } from '$typography/types';
  import '$typography/scale.css';

  type Props = Omit<HTMLAttributes<HTMLElement>, 'children'> & {
    children: Snippet;
    as?: TextElement;
    variant?: TextVariant;
    tone?: TypographyTone;
  };

  let {
    children,
    as = 'p',
    variant = 'body',
    tone = 'primary',
    class: className,
    ...attributes
  }: Props = $props();
</script>

<svelte:element
  this={as}
  {...attributes}
  class={['text', className]}
  data-variant={variant}
  data-tone={tone}
>
  {@render children()}
</svelte:element>

<style>
  .text {
    margin: 0;
    font-family: system-ui, sans-serif;
    font-size: var(--type-size-0);
    font-weight: var(--type-weight-text);
    line-height: var(--type-leading-text);
    /* Match headings by keeping the system font's natural spacing. */
    letter-spacing: normal;
    overflow-wrap: anywhere;
  }

  p.text:not(:last-child) {
    margin-bottom: var(--type-gap);
  }

  .text[data-variant='lead'] {
    /* One scale step above body copy gives introductions emphasis without a separate scale. */
    font-size: var(--type-size-1);
  }

  .text[data-variant='small'],
  .text[data-variant='caption'],
  .text[data-variant='eyebrow'] {
    /* Supporting roles share one step below body copy; avoid progressively tinier labels. */
    font-size: var(--type-size-small);
  }

  .text[data-variant='eyebrow'] {
    /* Uppercase and the heading weight distinguish labels without another size or spacing rule. */
    font-weight: var(--type-weight-heading);
    text-transform: uppercase;
  }

  /* Use the same light/dark shade pairs as headings so tones remain interchangeable. */
  .text[data-tone='primary'] {
    color: light-dark(var(--color-700), var(--color-300));
  }

  .text[data-tone='complement'] {
    color: light-dark(var(--color-complement-700), var(--color-complement-300));
  }

  .text[data-tone='inherit'] {
    color: inherit;
  }
</style>
