<script lang="ts">
  import type { SearchProgress } from '$lib/minesweeper/constraint-solving/search-settings';
  import type { GameConfig } from '$lib/minesweeper/game';
  type Props = {
    config: GameConfig;
    searchProgress: SearchProgress | null;
    searchElapsedMs: number;
    onrandom: () => void;
    onback: () => void;
  };
  let { config, searchProgress, searchElapsedMs, onrandom, onback }: Props = $props();
</script>

<div class="loading-overlay search-overlay">
  <div class="search-panel" role="group" aria-labelledby="search-title">
    <h3 id="search-title" role="status">Looking for a solvable game…</h3>
    <div class="search-actions">
      <button type="button" class="action" onclick={onrandom}>Play random board</button>
      <button type="button" class="action" onclick={onback}>Back to main menu</button>
    </div>
    <p>
      Checking that every safe square can be found using clues, without guessing. Your first square
      and its neighbors stay safe.
    </p>
    <p>Both actions stop the search. A random board may require guessing.</p>
    <p class="search-phase">
      {searchProgress?.phase === 'iterative'
        ? 'Adding mines while preserving solvability'
        : 'Trying random boards'}
    </p>
    <dl class="search-stats">
      <div>
        <dt>Board</dt>
        <dd>{config.rows} × {config.columns}</dd>
      </div>
      <div>
        <dt>Mines</dt>
        <dd>{config.mines}</dd>
      </div>
      <div>
        <dt>Boards checked</dt>
        <dd>{(searchProgress?.boardsChecked ?? 0).toLocaleString()}</dd>
      </div>
      <div>
        <dt>Time searching</dt>
        <dd>{(searchElapsedMs / 1000).toFixed(1)} s</dd>
      </div>
      {#if searchProgress?.phase === 'iterative'}
        <div>
          <dt>Mines placed</dt>
          <dd>{searchProgress.minesPlaced} / {config.mines}</dd>
        </div>
      {/if}
    </dl>
  </div>
</div>

<style>
  .search-overlay {
    place-items: start center;
    padding-block: 1.5rem;
  }

  .search-panel {
    position: sticky;
    top: 1rem;
    box-sizing: border-box;
    width: min(100%, 24rem);
    padding: 1.25rem;
    border: 1px solid var(--theme-border-color);
    border-radius: 0.5rem;
    background: light-dark(var(--color-50), var(--color-900));
    color: light-dark(var(--color-700), var(--color-300));
    font-size: 0.875rem;
    line-height: 1.5;
  }

  .search-panel h3 {
    margin: 0;
    color: light-dark(var(--color-950), var(--color-50));
    font-size: 1.125rem;
  }

  .search-phase {
    font-weight: 600;
  }

  .search-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    margin-top: 0.75rem;
  }

  .search-stats {
    display: grid;
    gap: 0.375rem;
    margin-block: 1rem;
    font-variant-numeric: tabular-nums;
  }

  .search-stats > div {
    display: flex;
    justify-content: space-between;
    gap: 0.75rem;
  }

  .search-stats dd {
    margin: 0;
    color: light-dark(var(--color-950), var(--color-50));
  }
</style>
