<script lang="ts">
  import {
    type HintRole,
    coordinateLabel,
    positionLabel,
  } from '#lib/components/minesweeper/presentation.js';
  import type { GameConfig } from '#lib/minesweeper/game.js';
  type Props = { index: number; role: HintRole; config: GameConfig };
  let { index, role, config }: Props = $props();
</script>

<span class="hint-coordinate" data-hint-role={role} aria-label={positionLabel(index, config)}>
  {coordinateLabel(index, config)}
</span>

<style>
  .hint-coordinate {
    display: inline-flex;
    align-items: center;
    min-height: 1.5rem;
    padding: 0.05rem 0.4rem;
    border: 1px solid var(--hint-stroke);
    border-radius: 0.35rem;
    background: var(--hint-fill);
    color: var(--hint-stroke);
    font-size: 0.85em;
    font-variant-numeric: tabular-nums;
    font-weight: 700;
    line-height: 1.2;
    white-space: nowrap;
  }

  .hint-coordinate[data-hint-role='clue'] {
    padding-inline: 0.1rem;
    border-color: transparent;
    background: transparent;
  }
</style>
