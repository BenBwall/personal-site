<script lang="ts">
  import Details from '#lib/components/Details.svelte';
  import HintCoordinate from '#lib/components/minesweeper/HintCoordinate.svelte';
  import HintExplanation from '#lib/components/minesweeper/HintExplanation.svelte';
  import {
    type HintRole,
    countLabel,
    positionLabel,
  } from '#lib/components/minesweeper/presentation.js';
  import type { FlagCheck, FlagCheckMode } from '#lib/minesweeper/check-flags.js';
  import {
    type PlayableHint,
    hintProofSteps,
  } from '#lib/minesweeper/constraint-solving/generate-hints.js';
  import type { Game } from '#lib/minesweeper/game.js';
  type Props = {
    game: Game;
    hints: PlayableHint[] | null;
    hintCursor: number;
    flagCheck: FlagCheck | null;
    flagCheckMode: FlagCheckMode;
    selectedFlagIndex: number | null;
    showHintDetails: boolean;
    activeHintLegend: { role: HintRole; label: string; count: number }[];
    showHints: () => void;
    checkPlacedFlags: () => void;
    clearHints: () => void;
    scrollToCell: (index: number) => void;
    performHint: (hint: PlayableHint) => void;
    nextHint: () => void;
    lastHint: () => void;
  };
  let {
    game,
    hints,
    hintCursor,
    flagCheck,
    flagCheckMode = $bindable(),
    selectedFlagIndex = $bindable(),
    showHintDetails = $bindable(),
    activeHintLegend,
    showHints,
    checkPlacedFlags,
    clearHints,
    scrollToCell,
    performHint,
    nextHint,
    lastHint,
  }: Props = $props();
  const activeHint = $derived(hints?.[hintCursor] ?? null);
  const wrongFlagsCount = $derived(
    flagCheck?.flags.filter((flag) => flag.status === 'incorrect').length ?? 0,
  );
  const checkedFlagsToShow = $derived(
    flagCheck?.flags.filter((flag) => flag.status === 'incorrect') ?? [],
  );
  const hintDetailsLabel = $derived(
    showHintDetails ? 'Hide supporting cells' : 'Show supporting cells',
  );
  const hintAction = (hint: PlayableHint): string => {
    if (hint.kind === 'mine') {
      return game.flagsCount === game.config.mines ? 'Make room for a flag, then flag' : 'Flag';
    }
    return game.cells[hint.index].flagged ? 'Remove the flag, then reveal' : 'Reveal safely';
  };
</script>

<div class="hint-area">
  <div class="hint-toolbar">
    <button type="button" class="action" onclick={showHints}>Hint</button>
    <div class="flag-check-control" role="group" aria-label="Flag checking">
      <button type="button" class="action" onclick={checkPlacedFlags}>Check flags</button>
      <label class="flag-check-mode">
        <input
          type="checkbox"
          checked={flagCheckMode === 'proof'}
          onchange={(event) => {
            flagCheckMode = event.currentTarget.checked ? 'proof' : 'board';
            if (flagCheck !== null) {
              checkPlacedFlags();
            } else {
              clearHints();
            }
          }}
        />
        <span>Only report flags the clues prove wrong</span>
      </label>
    </div>
  </div>
  {#if flagCheck !== null}
    <div class="hint-card">
      <p class="hint-heading" role="status">
        {#if flagCheck.flags.length === 0}
          No flags placed yet.
        {:else if flagCheck.mode === 'proof'}
          {#if wrongFlagsCount === 0}
            No flags could be proven wrong from the revealed clues.
          {:else if flagCheck.flags.length === 1}
            Your flag is provably wrong.
          {:else}
            {wrongFlagsCount} of your {countLabel(flagCheck.flags.length, 'flag')}
            {wrongFlagsCount === 1 ? 'is' : 'are'} provably wrong.
          {/if}
        {:else if wrongFlagsCount === 0}
          {flagCheck.flags.length === 1
            ? 'Your flag is'
            : `All ${flagCheck.flags.length} flags are`}
          correct.
        {:else if flagCheck.flags.length === 1}
          Your flag is incorrect.
        {:else}
          {wrongFlagsCount} of your {countLabel(flagCheck.flags.length, 'flag')}
          {wrongFlagsCount === 1 ? 'is' : 'are'} incorrect.
        {/if}
      </p>
      {#if checkedFlagsToShow.length > 0}
        {#if checkedFlagsToShow.length > 1}
          <p class="hint-explanation">
            Select a flag's coordinate to locate it and highlight any supporting clues.
          </p>
        {/if}
        <ul class="flag-check-list">
          {#each checkedFlagsToShow as flag (flag.index)}
            <li>
              <button
                type="button"
                class="flag-location"
                onclick={() => {
                  selectedFlagIndex = flag.index;
                  scrollToCell(flag.index);
                }}
                aria-pressed={selectedFlagIndex === flag.index}
                aria-label={`Locate incorrect flag at ${positionLabel(flag.index, game.config)}`}
              >
                <HintCoordinate index={flag.index} role="wrong-flag" config={game.config} />
              </button>
              <div class="hint-explanation" id={`flag-explanation-${flag.index}`}>
                {#if flag.hint}
                  {const steps = $derived(hintProofSteps(flag.hint))}
                  {#if steps.length > 1}
                    <ol class="flag-proof">
                      {#each steps as step (step.index)}
                        <li><HintExplanation {game} hint={step} /></li>
                      {/each}
                    </ol>
                  {:else}
                    <p><HintExplanation {game} hint={flag.hint} /></p>
                  {/if}
                {:else}
                  <p>
                    The hidden mine layout shows this square is safe. No proof was found from the
                    revealed clues.
                  </p>
                {/if}
              </div>
            </li>
          {/each}
        </ul>
        <div class="hint-legend" aria-label="Highlighted cells">
          {#each activeHintLegend as { role, label, count } (role)}
            <span class="hint-legend-item">
              <span class="hint-swatch" data-hint-role={role} aria-hidden="true"></span>
              {label}{count > 1 ? ` (${count})` : ''}
            </span>
          {/each}
        </div>
      {/if}
      <div class="hint-actions">
        <button type="button" class="action hint-secondary" onclick={clearHints}>Hide</button>
      </div>
    </div>
  {/if}
  {#if hints !== null}
    <div class="hint-card">
      <div aria-live="polite">
        {#if activeHint}
          <p class="hint-count">Hint {hintCursor + 1} of {hints.length}</p>
          <p class="hint-heading" id="current-game-hint">
            {hintAction(activeHint)}
            <HintCoordinate
              index={activeHint.index}
              role={activeHint.kind === 'mine' ? 'target-mine' : 'target-safe'}
              config={game.config}
            />
          </p>
          <p class="hint-explanation"><HintExplanation {game} hint={activeHint} /></p>
        {:else}
          <p class="hint-explanation">
            No guaranteed move follows from the revealed clues right now.
          </p>
        {/if}
      </div>
      <div class="hint-actions">
        {#if activeHint}
          <button
            type="button"
            class="action hint-apply"
            onclick={() => performHint(activeHint)}
            disabled={activeHint.kind === 'mine' && game.flagsCount >= game.config.mines}
            title={activeHint.kind === 'mine' && game.flagsCount >= game.config.mines
              ? 'Remove a flag before applying this hint'
              : undefined}
            aria-describedby="current-game-hint"
          >
            Apply hint
          </button>
          <button type="button" class="action hint-secondary" onclick={nextHint}>
            Next hint
          </button>
          <button type="button" class="action hint-secondary" onclick={lastHint}>
            Last hint
          </button>
        {/if}
        <button type="button" class="action hint-secondary" onclick={clearHints}>Hide</button>
      </div>
      {#if activeHint}
        <div class="hint-key">
          <Details title={hintDetailsLabel} bind:open={showHintDetails}>
            <div class="hint-legend" aria-label="Highlighted cells">
              {#each activeHintLegend as { role, label, count } (role)}
                <span class="hint-legend-item">
                  <span class="hint-swatch" data-hint-role={role} aria-hidden="true"></span>
                  {label}{count > 1 ? ` (${count})` : ''}
                </span>
              {/each}
            </div>
          </Details>
        </div>
      {/if}
    </div>
  {/if}
</div>

<style>
  .hint-area {
    display: grid;
    justify-items: start;
    gap: 0.75rem;
    min-width: 0;
    width: 100%;
    margin: -0.25rem 0 1.25rem;
  }

  .hint-card {
    width: 100%;
    box-sizing: border-box;
    padding: 0.75rem 0.875rem;
    border: 1px solid var(--theme-border-color);
    border-radius: 0.5rem;
    background: light-dark(var(--color-50), var(--color-900));
    color: light-dark(var(--color-800), var(--color-200));
    font-size: 0.875rem;
    line-height: 1.45;
    overflow-wrap: anywhere;
  }

  .hint-toolbar {
    --control-font-size: 0.875rem;
    display: grid;
    grid-template-columns: max-content minmax(0, max-content);
    align-items: start;
    gap: 0.5em;
    width: 100%;
    font-size: var(--control-font-size);
  }

  .hint-toolbar .action {
    min-height: 2.5em;
    padding: 0.5em 0.875em;
    border-radius: 0.375em;
    font-size: inherit;
  }

  .flag-check-control {
    display: grid;
    gap: 0.25em;
    box-sizing: border-box;
    min-width: 0;
    max-width: 100%;
  }

  .flag-check-control .action {
    justify-self: stretch;
  }

  .flag-check-mode {
    display: flex;
    align-items: center;
    gap: 0.5em;
    width: 100%;
    min-height: 2em;
    font-size: inherit;
    line-height: 1.25;
    cursor: pointer;
  }

  .flag-check-mode input {
    flex-shrink: 0;
    width: 1.125em;
    height: 1.125em;
    margin: 0;
    font: inherit;
    accent-color: light-dark(var(--color-600), var(--color-400));
    cursor: pointer;
  }

  .flag-check-list {
    display: grid;
    gap: 0.875rem;
    max-height: 20rem;
    overflow-y: auto;
    margin: 0.75rem 0 0;
    padding-left: 1.25rem;
  }

  .flag-location {
    padding: 0;
    border: 0;
    border-radius: 0.35rem;
    background: transparent;
    font: inherit;
    cursor: pointer;
  }

  .flag-location[aria-pressed='true'] {
    outline: 2px solid light-dark(var(--color-600), var(--color-300));
    outline-offset: 2px;
  }

  .flag-proof {
    display: grid;
    gap: 0.5rem;
    margin: 0;
    padding-left: 1.25rem;
  }

  .flag-check-list .hint-explanation p {
    margin: 0;
  }

  .hint-count {
    margin: 0 0 0.25rem;
    color: light-dark(var(--color-700), var(--color-300));
    font-size: 0.75rem;
    font-weight: 700;
    letter-spacing: 0.03em;
  }

  .hint-heading {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    flex-wrap: wrap;
    margin: 0;
    font-size: 1rem;
    font-weight: 700;
  }

  .hint-explanation {
    margin: 0.35rem 0 0;
  }

  .hint-key {
    margin-top: 0.5rem;
    color: light-dark(var(--color-700), var(--color-300));
    font-size: 0.75rem;
  }

  .hint-legend {
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem 0.85rem;
    padding: 0.625rem 0.875rem;
  }

  .hint-legend-item {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
  }

  .hint-swatch {
    width: 0.7rem;
    height: 0.7rem;
    box-sizing: border-box;
    border: 2px solid var(--hint-stroke);
    border-radius: 0.2rem;
    background: var(--hint-fill);
  }

  .hint-actions {
    display: flex;
    gap: 0.5rem;
    flex-wrap: wrap;
    margin-top: 0.625rem;
  }

  .hint-actions .action.hint-apply {
    border-color: light-dark(var(--color-300), var(--color-700));
    background: light-dark(var(--color-200), var(--color-800));
    color: light-dark(var(--color-900), var(--color-100));
    font-weight: 650;
  }

  .hint-actions .action.hint-apply:hover {
    background: light-dark(var(--color-300), var(--color-700));
  }

  .hint-actions .action.hint-secondary {
    border-color: transparent;
    background: transparent;
  }

  .hint-actions .action.hint-secondary:hover {
    border-color: var(--theme-border-color);
    background: light-dark(var(--color-100), var(--color-800));
  }

  .hint-actions .action:disabled {
    opacity: 0.55;
    cursor: default;
  }
</style>
