<script lang="ts">
  import HintCoordinate from '$lib/components/minesweeper/HintCoordinate.svelte';
  import {
    type HintRole,
    coordinateLabel,
    coordinateList,
    countLabel,
  } from '$lib/components/minesweeper/presentation';
  import type {
    HintConstraint,
    PlayableHint,
  } from '$lib/minesweeper/constraint-solving/generate-hints';
  import type { Game } from '$lib/minesweeper/game';
  type Props = { game: Game; hint: PlayableHint };
  let { game, hint }: Props = $props();
</script>

{#snippet hintCoordinates(indices: readonly number[], role: HintRole)}
  {#each indices as index, position (index)}
    {#if position > 0}{position === indices.length - 1 ? ' and ' : ', '}{/if}
    <HintCoordinate {index} {role} config={game.config} />
  {/each}
{/snippet}

{#snippet constraintFact(clue: HintConstraint)}
  {const accounted = $derived(game.cells[clue.clueIndex].adjacent - clue.mines)}
  Clue <HintCoordinate index={clue.clueIndex} role="clue" config={game.config} />
  {#if accounted > 0}
    already has {countLabel(accounted, 'mine')} accounted for and
  {/if}
  needs {countLabel(clue.mines, 'mine')} among {coordinateList(clue.cells, game.config)}.
{/snippet}

{const reason = $derived(hint.reason)}
{#if reason.kind === 'satisfied-clue'}
  <HintCoordinate index={reason.clueIndex} role="clue" config={game.config} /> shows {reason.mineCount}.
  {@render hintCoordinates(hint.references.provenMineIndices, 'proven-mine')}
  {reason.mineCount === 1 ? 'already accounts' : 'already account'} for
  {reason.mineCount === 1 ? 'its only mine' : `all ${reason.mineCount} mines`}. A mine at <HintCoordinate
    index={hint.index}
    role="target-safe"
    config={game.config}
  /> would make
  {reason.mineCount + 1} neighboring mines, contradicting that clue.
  {coordinateLabel(hint.index, game.config)} must be safe.
{:else if reason.kind === 'clue'}
  {const mineCount = $derived(game.cells[reason.clueIndex].adjacent)}
  <HintCoordinate index={reason.clueIndex} role="clue" config={game.config} /> shows {mineCount}.
  {#if reason.remainingMines === 0}
    {#if reason.knownMines > 0}
      {@render hintCoordinates(hint.references.provenMineIndices, 'proven-mine')}
      {reason.knownMines === 1 ? 'already accounts' : 'already account'} for
      {mineCount === 1 ? 'its only mine' : `all ${mineCount} mines`}. A mine at <HintCoordinate
        index={hint.index}
        role="target-safe"
        config={game.config}
      /> would make
      {mineCount + 1} neighboring mines, contradicting that clue.
    {:else}
      None of its neighboring squares can contain a mine, including
      <HintCoordinate index={hint.index} role="target-safe" config={game.config} />.
    {/if}
    {coordinateLabel(hint.index, game.config)} must be safe.
  {:else}
    {#if reason.knownMines > 0}
      {@render hintCoordinates(hint.references.provenMineIndices, 'proven-mine')}
      {reason.knownMines === 1 ? 'accounts' : 'account'} for
      {countLabel(reason.knownMines, 'mine')}.
    {/if}
    {#if reason.knownSafe > 0}
      {@render hintCoordinates(hint.references.provenSafeIndices, 'proven-safe')}
      {reason.knownSafe === 1 ? 'is' : 'are'} safe.
    {/if}
    {#if reason.unknownNeighbors === 1}
      Its only remaining hidden neighbor is
      <HintCoordinate index={hint.index} role="proven-mine" config={game.config} />, so that square
      must be a mine.
    {:else}
      Its remaining {countLabel(reason.remainingMines, 'mine')} must be in
      {@render hintCoordinates(hint.references.undecidedIndices, 'proven-mine')}. There {reason.unknownNeighbors ===
      1
        ? 'is'
        : 'are'} exactly
      {countLabel(reason.unknownNeighbors, 'square')}, so each must contain a mine.
    {/if}
  {/if}
{:else if reason.kind === 'constraints'}
  {#if reason.proof.kind === 'covered-clue'}
    {#each reason.proof.groups as group (group.constraint.clueIndex)}
      {@render constraintFact(group.constraint)}
      {#if group.outside.length > 0}
        {#if hint.kind === 'safe'}
          At least {countLabel(group.bound, 'mine')} must be among
          {coordinateList(group.shared, game.config)} next to clue
          {coordinateLabel(reason.proof.anchor.clueIndex, game.config)}.
        {:else}
          At most {countLabel(group.bound, 'mine')} can be among
          {coordinateList(group.shared, game.config)} next to clue
          {coordinateLabel(reason.proof.anchor.clueIndex, game.config)}.
        {/if}
      {/if}<br />
    {/each}
    {@render constraintFact(reason.proof.anchor)}<br />
    {#if hint.kind === 'safe'}
      This accounts for all {countLabel(reason.proof.anchor.mines, 'mine')} needed by clue {coordinateLabel(
        reason.proof.anchor.clueIndex,
        game.config,
      )}, so
      {coordinateLabel(hint.index, game.config)} is safe.
    {:else}
      This leaves {countLabel(reason.proof.remaining.length, 'square')} that must be mines, including
      {coordinateLabel(hint.index, game.config)}.
    {/if}
  {:else}
    {#each reason.proof.clues.slice(0, 3) as clue (clue.clueIndex)}
      {@render constraintFact(clue)}<br />
    {/each}
    {#if reason.proof.clues.length > 3}
      {reason.proof.clues.length - 3} other nearby clues also constrain these squares.<br />
    {/if}
    Together, these counts force {coordinateLabel(hint.index, game.config)} to be
    {hint.kind === 'safe' ? 'safe' : 'a mine'}; the opposite would contradict the clues.
  {/if}
{:else}
  The board has {countLabel(game.config.mines, 'mine')}. {countLabel(reason.knownMines, 'mine')}
  {reason.knownMines === 1 ? 'is' : 'are'} already proven, leaving
  {countLabel(reason.remainingMines, 'mine')} among {countLabel(
    reason.unknownCells,
    'undecided square',
  )}. This square is {hint.kind === 'safe' ? 'safe' : 'a mine'}.
{/if}
