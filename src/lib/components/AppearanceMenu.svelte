<script lang="ts">
  import { browser } from '$app/environment';
  import ColorSchemeToggle from '$components/ColorSchemeToggle.svelte';
  import CheckboxInput from '$inputs/CheckboxInput.svelte';
  import InputField from '$inputs/InputField.svelte';
  import IntegerInput from '$inputs/IntegerInput.svelte';
  import RangeInput from '$inputs/RangeInput.svelte';
  import {
    applyTheme,
    defaultTheme,
    fullHueRotation,
    getCurrentTheme,
    maxChroma,
    maxRainbowIntervalMs,
    setTheme,
  } from '$lib/theme/theme';
  import { preferences, setPreference } from '$theme/preferences.svelte';
  import { Palette } from '@lucide/svelte';
  import { onMount } from 'svelte';

  let dialog: HTMLDialogElement;
  let isOpen = $state(false);
  let theme = $state(browser ? getCurrentTheme() : { ...defaultTheme });

  onMount(() => applyTheme(theme));

  const saveTheme = () => {
    const root = document.documentElement;
    const rainbowAnimation = root
      .getAnimations()
      .find(
        (animation) =>
          animation instanceof CSSAnimation && animation.animationName === 'rainbow-hue',
      );

    if (rainbowAnimation) {
      // Capture the displayed hue only when saving, and rebase to avoid jumps on speed changes.
      const style = getComputedStyle(root);
      const hue = Number.parseFloat(style.getPropertyValue('--theme-hue'));
      const offset = Number.parseFloat(style.getPropertyValue('--rainbow-hue-offset'));
      theme.hue = Math.round(hue + offset) % fullHueRotation;
      rainbowAnimation.currentTime = 0;
    }

    setTheme(theme);
  };

  const openDialog = () => {
    dialog.showModal();
    isOpen = true;
  };
</script>

<svelte:window onpagehide={saveTheme} />

<button
  type="button"
  aria-label="Appearance"
  title="Appearance"
  aria-haspopup="dialog"
  aria-controls="appearance-dialog"
  aria-expanded={isOpen}
  onclick={openDialog}
>
  <Palette size={20} aria-hidden="true" />
</button>

<dialog
  bind:this={dialog}
  id="appearance-dialog"
  aria-label="Appearance"
  closedby="any"
  onclose={() => (isOpen = false)}
>
  <InputField label="Dark mode">
    <ColorSchemeToggle />
  </InputField>

  <CheckboxInput
    label="Reduced motion"
    checked={preferences.reducedMotion}
    title="Pause rainbow colors and turn off interface animations"
    onCheckedChange={(checked) => setPreference('reducedMotion', checked)}
  />
  <RangeInput
    label="Luminosity"
    min={0}
    max={1}
    step={0.01}
    bind:value={theme.luminosity}
    valueLabel={`${Math.round(theme.luminosity * 100)}%`}
    aria-valuetext={`${Math.round(theme.luminosity * 100)} percent`}
    onValueChange={saveTheme}
  />
  <RangeInput
    label="Chroma"
    min={0}
    max={maxChroma}
    step={0.01}
    bind:value={theme.chroma}
    valueLabel={theme.chroma.toFixed(2)}
    onValueChange={saveTheme}
  />
  <RangeInput
    label="Hue"
    min={0}
    max={fullHueRotation}
    step={1}
    bind:value={theme.hue}
    valueLabel={theme.rainbowEnabled
      ? preferences.reducedMotion
        ? 'Paused'
        : 'Cycling'
      : `${theme.hue}°`}
    disabled={theme.rainbowEnabled}
    aria-valuetext={theme.rainbowEnabled
      ? preferences.reducedMotion
        ? 'Paused'
        : 'Cycling'
      : `${theme.hue} degrees`}
    onValueChange={saveTheme}
  />
  <CheckboxInput
    label="Rainbow hue"
    bind:checked={theme.rainbowEnabled}
    onCheckedChange={saveTheme}
  />
  <IntegerInput
    label="Hue increment (°)"
    min={1}
    max={fullHueRotation - 1}
    required
    title="1–359 degrees per interval"
    bind:value={theme.rainbowIncrement}
    onValueChange={saveTheme}
  />
  <IntegerInput
    label="Interval (ms)"
    min={1}
    max={maxRainbowIntervalMs}
    title="1–2,147,483,647 milliseconds"
    required
    bind:value={theme.rainbowIntervalMs}
    onValueChange={saveTheme}
  />
</dialog>

<style>
  button {
    display: grid;
    place-items: center;
    flex: 0 0 auto;
    width: 2.75rem;
    height: 2.75rem;
    margin-inline-start: auto;
    padding: 0;
    border: 0;
    border-bottom: 2px solid transparent;
    background: transparent;
    color: light-dark(var(--color-700), var(--color-300));
    cursor: pointer;
  }

  button:hover {
    background: light-dark(var(--color-100), var(--color-900));
    color: light-dark(var(--color-950), var(--color-50));
  }

  button:focus-visible {
    outline: 2px solid light-dark(var(--color-600), var(--color-400));
    outline-offset: 3px;
  }

  button[aria-expanded='true'] {
    border-bottom-color: light-dark(var(--color-600), var(--color-400));
    color: light-dark(var(--color-950), var(--color-50));
  }

  dialog {
    inset: 5rem max(1rem, calc((100vw - 70rem) / 2)) auto auto;
    box-sizing: border-box;
    width: min(20rem, calc(100vw - 2rem));
    max-height: calc(100dvh - 6rem);
    margin: 0;
    padding: 0.25rem;
    border: 1px solid var(--theme-border-color);
    background: light-dark(var(--color-50), var(--color-950));
    color: light-dark(var(--color-700), var(--color-300));
    font: inherit;
  }

  dialog::backdrop {
    background: rgb(0 0 0 / 8%);
  }
</style>
