<script lang="ts">
  import type { Snippet } from 'svelte';
  import type { HTMLAttributes } from 'svelte/elements';
  import type { HeadingLevel, TypographyTone } from '$typography/types';
  import '$typography/scale.css';

  type Props = Omit<HTMLAttributes<HTMLHeadingElement>, 'children'> & {
    children: Snippet;
    level?: HeadingLevel;
    size?: HeadingLevel;
    tone?: TypographyTone;
  };

  let { children, level = 2, size, tone, class: className, ...attributes }: Props = $props();
</script>

<svelte:element
  this={`h${level}`}
  {...attributes}
  class={['heading', className]}
  data-size={size ?? level}
  data-tone={tone ?? (level === 1 ? 'complement' : 'primary')}
>
  {@render children()}
</svelte:element>

<style>
  .heading {
    margin: 0;
    font-family: system-ui, sans-serif;
    font-weight: var(--type-weight-heading);
    line-height: var(--type-leading-heading);
    /* Keep the system font's spacing at every size instead of tuning for one font face. */
    letter-spacing: normal;
    overflow-wrap: anywhere;
  }

  .heading:not(:last-child) {
    margin-bottom: var(--type-gap);
  }

  /* Six consecutive scale steps; rem sizes keep their ratios at every viewport width. */
  .heading[data-size='1'] {
    font-size: var(--type-size-5);
  }

  .heading[data-size='2'] {
    font-size: var(--type-size-4);
  }

  .heading[data-size='3'] {
    font-size: var(--type-size-3);
  }

  .heading[data-size='4'] {
    font-size: var(--type-size-2);
  }

  .heading[data-size='5'] {
    font-size: var(--type-size-1);
  }

  .heading[data-size='6'] {
    font-size: var(--type-size-0);
  }

  /* Pair dark text on light surfaces with light text on dark surfaces for both palettes. */
  .heading[data-tone='primary'] {
    color: light-dark(var(--color-700), var(--color-300));
  }

  .heading[data-tone='complement'] {
    color: light-dark(var(--color-complement-700), var(--color-complement-300));
  }

  .heading[data-tone='inherit'] {
    color: inherit;
  }
</style>
