<script lang="ts">
  type Props = { won: boolean; onnewgame: () => void; ondismiss: () => void };
  let { won, onnewgame, ondismiss }: Props = $props();
</script>

<div class="end-overlay">
  <div class="end-panel">
    <p class="end-message" role="status">
      {won ? 'You won!' : 'Game over — you hit a mine.'}
    </p>
    <div class="end-actions">
      <button type="button" class="action" onclick={onnewgame}>New game</button>
      <button type="button" class="action" onclick={ondismiss}> Dismiss message </button>
    </div>
  </div>
</div>

<style>
  .end-overlay {
    z-index: 1;
    display: grid;
    place-items: start center;
    box-sizing: border-box;
    padding: clamp(1rem, 5vw, 3rem) 1rem;
    background: light-dark(
      color-mix(in srgb, var(--color-50) 55%, transparent),
      color-mix(in srgb, var(--color-950) 55%, transparent)
    );
    pointer-events: none;
  }

  .end-panel {
    position: sticky;
    top: 1rem;
    display: grid;
    justify-items: center;
    gap: 0.875rem;
    width: min(100%, 20rem);
    box-sizing: border-box;
    padding: 1.25rem;
    border: 1px solid var(--theme-border-color);
    border-radius: 0.5rem;
    background: light-dark(var(--color-50), var(--color-900));
    box-shadow: 0 0.75rem 2rem color-mix(in srgb, var(--color-950) 15%, transparent);
    pointer-events: auto;
  }

  .end-message {
    margin: 0;
    color: light-dark(var(--color-950), var(--color-50));
    font-size: 1.125rem;
    font-weight: 700;
    text-align: center;
  }

  .end-actions {
    display: flex;
    justify-content: center;
    gap: 0.5rem;
    flex-wrap: wrap;
  }
</style>
