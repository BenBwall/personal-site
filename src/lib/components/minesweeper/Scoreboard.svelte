<script lang="ts">
  type Props = {
    minesLeft: number;
    elapsedSeconds: number;
    pending: boolean;
    showNewGame: boolean;
    onnewgame: () => void;
  };
  let { minesLeft, elapsedSeconds, pending, showNewGame, onnewgame }: Props = $props();
</script>

<div class="scoreboard" class:pending aria-label="Game progress">
  <span><strong>{minesLeft}</strong> mines left</span>
  {#if showNewGame}
    <button type="button" class="action" onclick={onnewgame}>New game</button>
  {/if}
  <span><strong>{elapsedSeconds}</strong> seconds</span>
</div>

<style>
  .scoreboard {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);
    align-items: center;
    gap: 0.5rem;
    margin-bottom: 1.25rem;
    color: light-dark(var(--color-700), var(--color-300));
    font-size: 0.875rem;
  }

  .scoreboard .action {
    grid-column: 2;
    grid-row: 1;
  }

  .scoreboard > span:last-child {
    grid-column: 3;
    justify-self: end;
    text-align: right;
  }

  .scoreboard.pending {
    visibility: hidden;
  }

  .scoreboard strong {
    color: light-dark(var(--color-950), var(--color-50));
    font-variant-numeric: tabular-nums;
  }
</style>
