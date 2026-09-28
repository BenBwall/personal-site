<script lang="ts">
  import CheckboxInput from '$inputs/CheckboxInput.svelte';
  import IntegerInput from '$inputs/IntegerInput.svelte';
  import Details from '$lib/components/Details.svelte';
  import type { SearchSettings } from '$lib/minesweeper/constraint-solving/search-settings';
  import {
    BOARD_SIZES,
    type Difficulty,
    type GameConfig,
    MIN_BOARD_SIZE,
    boardSizeSchema,
    gameConfigSchema,
    maxMineCount,
    minesForDifficulty,
  } from '$lib/minesweeper/game';
  type Props = {
    difficulty: Difficulty | null;
    setupRows: number;
    setupColumns: number;
    setupMines: number;
    setupNoGuessingRequired: boolean;
    setupSearchSettings: SearchSettings;
    onstart: (config: GameConfig) => void;
    onpreview: (config: GameConfig) => void;
  };
  let {
    difficulty = $bindable(),
    setupRows = $bindable(),
    setupColumns = $bindable(),
    setupMines = $bindable(),
    setupNoGuessingRequired = $bindable(),
    setupSearchSettings = $bindable(),
    onstart,
    onpreview,
  }: Props = $props();
  const LARGE_BOARD_WARNING_CELLS = 2500;
  const DIFFICULTIES = [
    { id: 'easy', label: 'Easy' },
    { id: 'medium', label: 'Medium' },
    { id: 'hard', label: 'Hard' },
  ] as const satisfies readonly { id: Difficulty; label: string }[];
  const BOARD_SIZE_PRESETS = [
    { id: 'small', label: 'Small', ...BOARD_SIZES.small },
    { id: 'medium', label: 'Medium', ...BOARD_SIZES.medium },
    { id: 'large', label: 'Large', ...BOARD_SIZES.large },
  ] as const;
  type BoardSize = (typeof BOARD_SIZE_PRESETS)[number]['id'];
  let inputRevision = $state(0);
  const setupCellCount = $derived(setupRows * setupColumns);
  const mineLimit = $derived(
    boardSizeSchema.safeParse({ columns: setupColumns, rows: setupRows }).success
      ? maxMineCount(setupRows, setupColumns)
      : 1,
  );
  const selectedBoardSize = $derived<BoardSize | null>(
    BOARD_SIZE_PRESETS.find(({ rows, columns }) => rows === setupRows && columns === setupColumns)
      ?.id ?? null,
  );
  const setupConfig = (): GameConfig => ({
    columns: setupColumns,
    mines: setupMines,
    noGuessingRequired: setupNoGuessingRequired,
    rows: setupRows,
    searchSettings: setupNoGuessingRequired ? { ...setupSearchSettings } : undefined,
  });
  const updatePreview = () => {
    const config = setupConfig();
    if (gameConfigSchema.safeParse(config).success && setupCellCount <= LARGE_BOARD_WARNING_CELLS) {
      onpreview(config);
    }
  };

  const selectDifficulty = (selected: Difficulty) => {
    difficulty = selected;
    setupMines = minesForDifficulty(selected, setupRows, setupColumns);
    inputRevision += 1;
    updatePreview();
  };

  const updateMinesForSize = (rows: number, columns: number) => {
    setupMines = difficulty
      ? minesForDifficulty(difficulty, rows, columns)
      : Math.min(setupMines, maxMineCount(rows, columns));
  };

  const selectBoardSize = (selected: BoardSize) => {
    const { rows, columns } = BOARD_SIZES[selected];
    setupRows = rows;
    setupColumns = columns;
    updateMinesForSize(rows, columns);
    inputRevision += 1;
    updatePreview();
  };

  const applyGameSetup = (event: SubmitEvent) => {
    event.preventDefault();
    if (
      event.currentTarget instanceof HTMLFormElement &&
      event.currentTarget.querySelector('input[aria-invalid="true"]')
    ) {
      return;
    }
    const config = setupConfig();
    if (!gameConfigSchema.safeParse(config).success) {
      return;
    }
    onstart(config);
  };
</script>

<div class="menu-overlay">
  <div class="menu-panel" role="group" aria-labelledby="difficulty-title">
    <h3 id="difficulty-title">Choose difficulty</h3>
    <form class="setup-form" onsubmit={applyGameSetup}>
      <fieldset class="option-group">
        <legend>Board size</legend>
        <div class="option-buttons">
          {#each BOARD_SIZE_PRESETS as option (option.id)}
            <button
              type="button"
              class="action"
              class:active={selectedBoardSize === option.id}
              aria-pressed={selectedBoardSize === option.id}
              onclick={() => selectBoardSize(option.id)}
            >
              {option.label} <span class="option-size">{option.rows} × {option.columns}</span>
            </button>
          {/each}
        </div>
      </fieldset>
      <fieldset class="option-group">
        <legend>Difficulty</legend>
        <div class="option-buttons">
          {#each DIFFICULTIES as option (option.id)}
            <button
              type="button"
              class="action"
              class:active={difficulty === option.id}
              aria-pressed={difficulty === option.id}
              onclick={() => selectDifficulty(option.id)}
            >
              {option.label}
            </button>
          {/each}
        </div>
      </fieldset>
      {#key inputRevision}
        <div class="setup-inputs">
          <IntegerInput
            label="Rows"
            min={MIN_BOARD_SIZE}
            preserveInvalidDraft
            showValidationError
            required
            bind:value={setupRows}
            onValueChange={(value) => {
              setupRows = value;
              updateMinesForSize(value, setupColumns);
              updatePreview();
            }}
          />
          <IntegerInput
            label="Columns"
            min={MIN_BOARD_SIZE}
            preserveInvalidDraft
            showValidationError
            required
            bind:value={setupColumns}
            onValueChange={(value) => {
              setupColumns = value;
              updateMinesForSize(setupRows, value);
              updatePreview();
            }}
          />
          <IntegerInput
            label="Mines"
            min={1}
            max={mineLimit}
            title={`1–${mineLimit} mines`}
            preserveInvalidDraft
            showValidationError
            required
            bind:value={setupMines}
            onValueChange={(value) => {
              setupMines = value;
              difficulty = null;
              updatePreview();
            }}
          />
        </div>
      {/key}
      <Details title="How solvable boards are found">
        <p class="finder-explanation">
          The finder checks whether random boards can be solved using clues alone. If either search
          limit is reached, it adds mines one at a time while keeping the board solvable. Setting
          either limit to 0 skips random boards.
        </p>
      </Details>
      <CheckboxInput label="Solvable without guessing" bind:checked={setupNoGuessingRequired} />
      {#if setupNoGuessingRequired}
        <Details title="Solvable game finder">
          <div class="finder-settings">
            <IntegerInput
              label="Random board time limit (ms)"
              min={0}
              max={60_000}
              preserveInvalidDraft
              showValidationError
              required
              bind:value={setupSearchSettings.randomTimeLimitMs}
            />
            <IntegerInput
              label="Maximum random boards"
              min={0}
              max={100_000}
              preserveInvalidDraft
              showValidationError
              required
              bind:value={setupSearchSettings.maxRandomAttempts}
            />
          </div>
        </Details>
      {/if}
      {#if setupCellCount > LARGE_BOARD_WARNING_CELLS}
        <p class="size-warning" role="status">
          Large board: {setupCellCount.toLocaleString()} squares. It may take longer to load and respond
          to moves.
        </p>
      {/if}
      <button type="submit" class="action start-game">Start game</button>
    </form>
  </div>
</div>

<style>
  .menu-overlay {
    z-index: 1;
    display: grid;
    place-items: start center;
    box-sizing: border-box;
    padding: 1rem 0.75rem;
    background: light-dark(
      color-mix(in srgb, var(--color-50) 25%, transparent),
      color-mix(in srgb, var(--color-950) 25%, transparent)
    );
  }

  .finder-settings,
  .finder-explanation {
    padding: 0.875rem;
    font-size: 0.8125rem;
    line-height: 1.4;
  }

  .finder-settings {
    display: grid;
    gap: 0.5rem;
  }

  .finder-explanation {
    margin: 0;
  }

  .menu-panel {
    box-sizing: border-box;
    width: min(100%, 24rem);
    padding: 1rem;
    border: 1px solid var(--theme-border-color);
    border-radius: 0.5rem;
    background: light-dark(var(--color-50), var(--color-900));
    box-shadow: 0 0.75rem 2rem color-mix(in srgb, var(--color-950) 15%, transparent);
  }

  .menu-panel h3 {
    margin: 0;
    font-size: 1.125rem;
    line-height: 1.25;
  }

  .setup-form {
    display: grid;
    gap: 0.75rem;
    margin-top: 0.875rem;
  }

  .option-group {
    min-width: 0;
    margin: 0;
    padding: 0;
    border: 0;
  }

  .option-group legend {
    margin-bottom: 0.375rem;
    color: light-dark(var(--color-700), var(--color-300));
    font-size: 0.8125rem;
    font-weight: 600;
  }

  .option-buttons {
    display: flex;
    gap: 0.375rem;
    flex-wrap: wrap;
  }

  .option-buttons .action {
    padding-inline: 0.625rem;
  }

  .option-size {
    font-size: 0.75rem;
    white-space: nowrap;
  }

  .setup-inputs {
    display: grid;
    gap: 0.25rem;
  }

  .start-game {
    justify-self: start;
  }

  .size-warning {
    margin: 0;
    color: light-dark(var(--color-offset-120-700), var(--color-offset-120-300));
    font-size: 0.8125rem;
    line-height: 1.4;
  }
</style>
