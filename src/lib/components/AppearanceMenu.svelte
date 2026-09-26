<script lang="ts">
  import { browser } from '$app/environment';
  import ColorSchemeToggle from '$components/ColorSchemeToggle.svelte';
  import RainbowSettings from '$components/RainbowSettings.svelte';
  import CheckboxInput from '$inputs/CheckboxInput.svelte';
  import InputField from '$inputs/InputField.svelte';
  import RangeInput from '$inputs/RangeInput.svelte';
  import { preferences, setPreference } from '$lib/theme/preferences.svelte';
  import {
    applyTheme,
    defaultTheme,
    fullHueRotation,
    getCurrentTheme,
    maxChroma,
    setTheme,
  } from '$lib/theme/theme';
  import { Palette } from '@lucide/svelte';
  import { onMount } from 'svelte';

  let dialog: HTMLDialogElement;
  let isOpen = $state(false);
  let theme = $state(browser ? getCurrentTheme() : { ...defaultTheme });

  onMount(() => applyTheme(theme));

  const saveTheme = () => {
    const root = document.documentElement;
    const animations = root
      .getAnimations()
      .filter((animation) => animation instanceof CSSAnimation);
    if (animations.length > 0) {
      // Rebase running channels to their displayed values before changing animation timing.
      const style = getComputedStyle(root);
      for (const animation of animations) {
        switch (animation.animationName) {
          case 'rainbow-hue': {
            const hue = Number.parseFloat(style.getPropertyValue('--theme-hue'));
            const offset = Number.parseFloat(style.getPropertyValue('--rainbow-hue-offset'));
            theme.hue = Math.round(hue + offset) % fullHueRotation;
            break;
          }
          case 'rainbow-luminosity': {
            theme.luminosity = Number.parseFloat(style.getPropertyValue('--theme-luminosity'));
            break;
          }
          case 'rainbow-chroma': {
            theme.chroma = Number.parseFloat(style.getPropertyValue('--theme-chroma'));
            break;
          }
        }
        animation.currentTime = 0;
      }
    }

    setTheme(theme);
  };

  const openDialog = () => {
    dialog.showModal();
    isOpen = true;
  };

  const channelLabel = (enabled: boolean, value: string): string =>
    enabled ? (preferences.reducedMotion ? 'Paused' : 'Cycling') : value;
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
  <form novalidate onsubmit={(event) => event.preventDefault()}>
    <InputField label="Dark mode">
      <ColorSchemeToggle />
    </InputField>

    <CheckboxInput
      label="Reduced motion"
      checked={preferences.reducedMotion}
      title="Pause rainbow colors and turn off interface animations"
      onCheckedChange={(checked) => setPreference('reducedMotion', checked)}
    />
    <div class="slider-group">
      <RangeInput
        label="Luminosity"
        min={0}
        max={1}
        step={0.01}
        bind:value={theme.luminosity}
        valueLabel={channelLabel(
          theme.rainbowLuminosityEnabled,
          `${Math.round(theme.luminosity * 100)}%`,
        )}
        aria-valuetext={channelLabel(
          theme.rainbowLuminosityEnabled,
          `${Math.round(theme.luminosity * 100)} percent`,
        )}
        disabled={theme.rainbowLuminosityEnabled}
        onValueChange={saveTheme}
      />
      <RainbowSettings
        channel="luminosity"
        incrementLabel="Increment (%)"
        incrementMax={100}
        incrementTitle="1–100 percentage points per interval"
        bind:enabled={theme.rainbowLuminosityEnabled}
        bind:increment={theme.rainbowLuminosityIncrement}
        bind:intervalMs={theme.rainbowLuminosityIntervalMs}
        onChange={saveTheme}
      />
    </div>
    <div class="slider-group">
      <RangeInput
        label="Chroma"
        min={0}
        max={maxChroma}
        step={0.01}
        bind:value={theme.chroma}
        valueLabel={channelLabel(theme.rainbowChromaEnabled, theme.chroma.toFixed(2))}
        aria-valuetext={channelLabel(theme.rainbowChromaEnabled, theme.chroma.toFixed(2))}
        disabled={theme.rainbowChromaEnabled}
        onValueChange={saveTheme}
      />
      <RainbowSettings
        channel="chroma"
        incrementLabel="Increment (×0.01)"
        incrementMax={50}
        incrementTitle="1–50 hundredths per interval"
        bind:enabled={theme.rainbowChromaEnabled}
        bind:increment={theme.rainbowChromaIncrement}
        bind:intervalMs={theme.rainbowChromaIntervalMs}
        onChange={saveTheme}
      />
    </div>
    <div class="slider-group">
      <RangeInput
        label="Hue"
        min={0}
        max={fullHueRotation}
        step={1}
        bind:value={theme.hue}
        valueLabel={channelLabel(theme.rainbowEnabled, `${theme.hue}°`)}
        disabled={theme.rainbowEnabled}
        aria-valuetext={channelLabel(theme.rainbowEnabled, `${theme.hue} degrees`)}
        onValueChange={saveTheme}
      />
      <RainbowSettings
        channel="hue"
        incrementLabel="Increment (°)"
        incrementMax={fullHueRotation - 1}
        incrementTitle="1–359 degrees per interval"
        bind:enabled={theme.rainbowEnabled}
        bind:increment={theme.rainbowIncrement}
        bind:intervalMs={theme.rainbowIntervalMs}
        onChange={saveTheme}
      />
    </div>
  </form>
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

  .slider-group {
    border-block-start: 1px solid var(--theme-border-color);
  }

  .slider-group :global(label.stacked) {
    border-block: 0;
  }
</style>
