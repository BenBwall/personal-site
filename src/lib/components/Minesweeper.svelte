<script lang="ts">
  import CheckboxInput from '$inputs/CheckboxInput.svelte';
  import IntegerInput from '$inputs/IntegerInput.svelte';
  import Details from '$lib/components/Details.svelte';
  import { Heading } from '$lib/components/typography';
  import { type FlagCheck, checkFlags } from '$lib/minesweeper/check-flags';
  import {
    type HintConstraint,
    type PlayableHint,
    findPlayableHints,
    hintProofSteps,
  } from '$lib/minesweeper/constraint-solving/generate-hints';
  import {
    BOARD_SIZES,
    type Cell,
    type Difficulty,
    type Game,
    type GameConfig,
    MIN_BOARD_SIZE,
    boardSizeSchema,
    createGame,
    gameConfigSchema,
    maxMineCount,
    minesForDifficulty,
    revealAdjacentCells,
    revealCell,
    toggleFlag,
  } from '$lib/minesweeper/game';
  import {
    GAME_STORAGE_KEY,
    type SavedGameState,
    readSavedGameState,
    serializeGameState,
  } from '$lib/minesweeper/persistence';
  import { onMount, untrack } from 'svelte';
  import { on } from 'svelte/events';

  const MILLISECONDS_PER_SECOND = 1000;
  const SAVE_INTERVAL_MS = 10_000;
  const LARGE_BOARD_WARNING_CELLS = 2500;
  const CONFETTI_BURST_INTERVAL_MS = 1700;
  const CONFETTI_BURST_COUNT = 3;
  const DRAG_START_DISTANCE_PX = 5;
  const COLUMN_LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
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
  type HintRole =
    | 'wrong-flag'
    | 'target-mine'
    | 'target-safe'
    | 'clue'
    | 'proven-mine'
    | 'proven-safe'
    | 'undecided';
  const HINT_ROLE_LABELS: Record<HintRole, string> = {
    clue: 'Clue used',
    'proven-mine': 'Proven mine',
    'proven-safe': 'Proven safe square',
    'target-mine': 'Mine to flag',
    'target-safe': 'Safe square to reveal',
    undecided: 'Other undecided square',
    'wrong-flag': 'Incorrect flag',
  };
  const HINT_ROLE_ORDER: readonly HintRole[] = [
    'wrong-flag',
    'target-mine',
    'target-safe',
    'clue',
    'proven-mine',
    'proven-safe',
    'undecided',
  ];

  let game = $state(createGame());
  let difficulty = $state<Difficulty | null>('easy');
  let menuOpen = $state(true);
  let resultDismissed = $state(false);
  let setupRows = $state<number>(BOARD_SIZES.small.rows);
  let setupColumns = $state<number>(BOARD_SIZES.small.columns);
  let setupMines = $state<number>(
    minesForDifficulty('easy', BOARD_SIZES.small.rows, BOARD_SIZES.small.columns),
  );
  let setupNoGuessingRequired = $state(true);
  let generationError = $state<string | null>(null);
  let inputRevision = $state(0);
  let elapsedSeconds = $state(0);
  let storageReady = $state(false);
  let startedAt: number | null = null;
  let lastSavedAt = 0;
  let confettiRun = 0;
  let confettiInterval: number | undefined;
  let activeConfetti: { reset: () => void } | undefined;
  let boardScrollElement: HTMLDivElement;
  let boardScrollLeft = 0;
  let boardScrollTop = 0;
  let scrollToRestore: { left: number; top: number } | null = null;
  let boardDrag:
    | {
        pointerId: number;
        startX: number;
        startY: number;
        scrollLeft: number;
        scrollTop: number;
        horizontal: boolean;
        vertical: boolean;
        dragging: boolean;
      }
    | undefined;
  let isDragging = $state(false);
  let suppressDraggedClick = false;
  let hints = $state<PlayableHint[] | null>(null);
  let hintCursor = $state(0);
  let showHintDetails = $state(false);
  let flagCheck = $state<FlagCheck | null>(null);
  let selectedFlagIndex = $state<number | null>(null);

  const minesLeft = $derived(game.config.mines - game.flagsCount);
  const gameEnded = $derived(game.phase === 'won' || game.phase === 'lost');
  const showResultMessage = $derived(gameEnded && !resultDismissed);
  const activeHint = $derived(hints?.[hintCursor] ?? null);
  const selectedFlagHint = $derived(
    flagCheck?.wrongFlags.find((flag) => flag.index === selectedFlagIndex)?.hint ?? null,
  );
  const hintDetailsLabel = $derived(
    showHintDetails ? 'Hide supporting cells' : 'Show supporting cells',
  );
  const activeHintRoles = $derived.by(() => {
    const roles = new Map<number, HintRole>();
    if (activeHint) {
      const { references } = activeHint;
      if (showHintDetails) {
        for (const index of references.undecidedIndices) {
          roles.set(index, 'undecided');
        }
        for (const index of references.provenSafeIndices) {
          roles.set(index, 'proven-safe');
        }
        for (const index of references.provenMineIndices) {
          roles.set(index, 'proven-mine');
        }
      }
      for (const index of showHintDetails
        ? references.clueIndices
        : references.clueIndices.slice(0, 3)) {
        roles.set(index, 'clue');
      }
      roles.set(activeHint.index, activeHint.kind === 'mine' ? 'target-mine' : 'target-safe');
    }
    if (selectedFlagHint) {
      for (const step of hintProofSteps(selectedFlagHint)) {
        for (const index of step.references.clueIndices) {
          roles.set(index, 'clue');
        }
        roles.set(step.index, step.kind === 'mine' ? 'proven-mine' : 'proven-safe');
      }
    }
    for (const flag of flagCheck?.wrongFlags ?? []) {
      roles.set(flag.index, 'wrong-flag');
    }
    return roles;
  });
  const activeHintLegend = $derived(
    HINT_ROLE_ORDER.map((role) => ({
      count: [...activeHintRoles.values()].filter((value) => value === role).length,
      label: HINT_ROLE_LABELS[role],
      role,
    })).filter(({ count }) => count > 0),
  );
  const gameWidthRem = $derived(Math.min(70, game.config.columns * 3.4));
  const minBoardWidthPx = $derived(
    game.config.columns * 32 + Math.max(32, String(game.config.rows).length * 12),
  );
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
  const currentElapsedSeconds = () =>
    game.phase === 'playing' && startedAt !== null
      ? Math.floor((Date.now() - startedAt) / MILLISECONDS_PER_SECOND)
      : elapsedSeconds;

  const setupConfig = (): GameConfig => ({
    columns: setupColumns,
    mines: setupMines,
    noGuessingRequired: setupNoGuessingRequired,
    rows: setupRows,
  });

  const currentSavedState = (seconds: number): SavedGameState => {
    const setup = setupConfig();
    return {
      difficulty,
      elapsedSeconds: seconds,
      game,
      menuOpen,
      scrollLeft: boardScrollLeft,
      scrollTop: boardScrollTop,
      setup: gameConfigSchema.safeParse(setup).success ? setup : game.config,
    };
  };

  const saveState = (state: SavedGameState) => {
    const now = Date.now();
    try {
      window.localStorage.setItem(GAME_STORAGE_KEY, serializeGameState(state, now));
    } catch {
      // The game remains playable if browser storage is unavailable.
    }
    lastSavedAt = now;
  };

  $effect(() => {
    if (storageReady) {
      saveState(currentSavedState(untrack(currentElapsedSeconds)));
    }
  });

  $effect(() => {
    if (storageReady && boardScrollElement && scrollToRestore) {
      boardScrollElement.scrollTo(scrollToRestore.left, scrollToRestore.top);
      scrollToRestore = null;
    }
  });

  onMount(() => {
    try {
      const raw = window.localStorage.getItem(GAME_STORAGE_KEY);
      const saved = readSavedGameState(raw);
      if (saved) {
        game = saved.game;
        difficulty = saved.difficulty;
        menuOpen = saved.menuOpen;
        setupRows = saved.setup.rows;
        setupColumns = saved.setup.columns;
        setupMines = saved.setup.mines;
        setupNoGuessingRequired = saved.setup.noGuessingRequired;
        elapsedSeconds = saved.elapsedSeconds;
        boardScrollLeft = saved.scrollLeft;
        boardScrollTop = saved.scrollTop;
        scrollToRestore = { left: saved.scrollLeft, top: saved.scrollTop };
        startedAt =
          saved.game.phase === 'playing'
            ? Date.now() - saved.elapsedSeconds * MILLISECONDS_PER_SECOND
            : null;
      } else if (raw !== null) {
        window.localStorage.removeItem(GAME_STORAGE_KEY);
      }
    } catch {
      // A failed read starts a fresh game without blocking the page.
    }
    storageReady = true;
    if (game.phase === 'won' && !menuOpen && !document.hidden) {
      void celebrateWin();
    }

    const stopHiddenConfetti = () => {
      if (document.hidden) {
        stopConfetti();
      }
    };
    const unsubscribeHiddenConfetti = on(document, 'visibilitychange', stopHiddenConfetti);

    const motionObserver = new MutationObserver(() => {
      if (document.documentElement.dataset.reducedMotion === 'true') {
        stopConfetti();
      } else if (game.phase === 'won' && !menuOpen) {
        void celebrateWin();
      }
    });
    motionObserver.observe(document.documentElement, {
      attributeFilter: ['data-reduced-motion'],
      attributes: true,
    });

    const saveBeforeLeaving = () => saveState(currentSavedState(currentElapsedSeconds()));
    const interval = window.setInterval(() => {
      if (game.phase === 'playing' && startedAt !== null) {
        elapsedSeconds = currentElapsedSeconds();
        if (Date.now() - lastSavedAt >= SAVE_INTERVAL_MS) {
          saveBeforeLeaving();
        }
      }
    }, MILLISECONDS_PER_SECOND);
    const unsubscribePagehide = on(window, 'pagehide', saveBeforeLeaving);

    return () => {
      window.clearInterval(interval);
      unsubscribePagehide();
      unsubscribeHiddenConfetti();
      motionObserver.disconnect();
      stopConfetti();
      saveBeforeLeaving();
    };
  });

  const stopConfetti = () => {
    confettiRun += 1;
    window.clearInterval(confettiInterval);
    confettiInterval = undefined;
    activeConfetti?.reset();
    activeConfetti = undefined;
  };

  const celebrateWin = async () => {
    stopConfetti();
    const run = confettiRun;
    if (document.hidden || document.documentElement.dataset.reducedMotion === 'true') {
      return;
    }
    try {
      const { default: confettiLibrary } = await import('canvas-confetti');
      if (run !== confettiRun || game.phase !== 'won' || menuOpen || document.hidden) {
        return;
      }
      const confetti = confettiLibrary.create(undefined, { resize: true, useWorker: false });
      activeConfetti = confetti;
      let burstsLaunched = 0;
      const launch = () => {
        if (run !== confettiRun) {
          return;
        }
        if (
          game.phase !== 'won' ||
          menuOpen ||
          document.hidden ||
          document.documentElement.dataset.reducedMotion === 'true'
        ) {
          stopConfetti();
          return;
        }
        void confetti({
          disableForReducedMotion: document.documentElement.dataset.reducedMotion !== 'false',
          origin: { y: 0.65 },
          particleCount: burstsLaunched === 0 ? 160 : 60,
          spread: 100,
          startVelocity: 50,
        });
        burstsLaunched += 1;
        if (burstsLaunched === CONFETTI_BURST_COUNT) {
          window.clearInterval(confettiInterval);
          confettiInterval = undefined;
        }
      };
      confettiInterval = window.setInterval(launch, CONFETTI_BURST_INTERVAL_MS);
      launch();
    } catch {
      if (run === confettiRun) {
        stopConfetti();
      }
      // The completed board remains usable if the animation cannot load.
    }
  };

  const clearHints = () => {
    hints = null;
    hintCursor = 0;
    showHintDetails = false;
    flagCheck = null;
    selectedFlagIndex = null;
  };

  const scrollToCell = (index: number | undefined) => {
    if (index === undefined || !boardScrollElement) {
      return;
    }
    const cell = boardScrollElement.querySelector<HTMLButtonElement>(
      `[data-cell-index="${index}"]`,
    );
    if (!cell) {
      return;
    }
    const viewport = boardScrollElement.getBoundingClientRect();
    const target = cell.getBoundingClientRect();
    boardScrollElement.scrollBy({
      behavior: document.documentElement.dataset.reducedMotion === 'true' ? 'auto' : 'smooth',
      left: target.left + target.width / 2 - viewport.left - viewport.width / 2,
      top: target.top + target.height / 2 - viewport.top - viewport.height / 2,
    });
  };

  const showHints = () => {
    clearHints();
    hints = findPlayableHints(game);
    hintCursor = 0;
    showHintDetails = false;
    scrollToCell(hints[0]?.index);
  };

  const checkPlacedFlags = () => {
    clearHints();
    flagCheck = checkFlags(game);
    selectedFlagIndex = flagCheck?.wrongFlags[0]?.index ?? null;
    scrollToCell(flagCheck?.wrongFlags[0]?.index);
  };

  const nextHint = () => {
    if (!hints || hints.length === 0) {
      return;
    }
    hintCursor = (hintCursor + 1) % hints.length;
    scrollToCell(hints[hintCursor].index);
  };

  const lastHint = () => {
    if (!hints || hints.length === 0) {
      return;
    }
    hintCursor = (hintCursor - 1 + hints.length) % hints.length;
    scrollToCell(hints[hintCursor].index);
  };

  const reveal = (index: number) => {
    let next: Game;
    try {
      next = game.cells[index].revealed
        ? revealAdjacentCells(game, index)
        : revealCell(game, index);
    } catch (error) {
      generationError = error instanceof Error ? error.message : 'Could not create this board.';
      return;
    }
    generationError = null;
    clearHints();
    const justWon = game.phase !== 'won' && next.phase === 'won';
    if (game.phase === 'ready' && next.phase !== 'ready') {
      startedAt = Date.now();
    }
    game = next;
    if (justWon) {
      void celebrateWin();
    }
    if (next.phase !== 'playing' && startedAt !== null) {
      elapsedSeconds = Math.floor((Date.now() - startedAt) / MILLISECONDS_PER_SECOND);
    }
  };

  const performHint = (hint: PlayableHint) => {
    if (game.phase !== 'playing' || game.cells[hint.index].revealed) {
      return;
    }
    if (hint.kind === 'mine') {
      if (game.cells[hint.index].flagged || game.flagsCount >= game.config.mines) {
        return;
      }
      game = toggleFlag(game, hint.index);
      clearHints();
      return;
    }
    if (game.cells[hint.index].flagged) {
      game = toggleFlag(game, hint.index);
    }
    reveal(hint.index);
  };

  const beginBoardDrag = (event: PointerEvent) => {
    if (event.button !== 0 || !event.isPrimary || event.pointerType === 'touch') {
      return;
    }
    const horizontal = boardScrollElement.scrollWidth > boardScrollElement.clientWidth;
    const vertical = boardScrollElement.scrollHeight > boardScrollElement.clientHeight;
    if (!horizontal && !vertical) {
      return;
    }
    boardDrag = {
      dragging: false,
      horizontal,
      pointerId: event.pointerId,
      scrollLeft: boardScrollElement.scrollLeft,
      scrollTop: boardScrollElement.scrollTop,
      startX: event.clientX,
      startY: event.clientY,
      vertical,
    };
  };

  const moveBoardDrag = (event: PointerEvent) => {
    if (!boardDrag || event.pointerId !== boardDrag.pointerId || !(event.buttons & 1)) {
      return;
    }
    const deltaX = event.clientX - boardDrag.startX;
    const deltaY = event.clientY - boardDrag.startY;
    if (
      !boardDrag.dragging &&
      Math.hypot(boardDrag.horizontal ? deltaX : 0, boardDrag.vertical ? deltaY : 0) <
        DRAG_START_DISTANCE_PX
    ) {
      return;
    }
    if (!boardDrag.dragging) {
      boardDrag.dragging = true;
      isDragging = true;
      boardScrollElement.setPointerCapture(event.pointerId);
    }
    event.preventDefault();
    boardScrollElement.scrollLeft = boardDrag.scrollLeft - deltaX;
    boardScrollElement.scrollTop = boardDrag.scrollTop - deltaY;
  };

  const endBoardDrag = (event: PointerEvent) => {
    if (!boardDrag || event.pointerId !== boardDrag.pointerId) {
      return;
    }
    if (boardDrag.dragging) {
      suppressDraggedClick = true;
      window.setTimeout(() => {
        suppressDraggedClick = false;
      }, 0);
    }
    boardDrag = undefined;
    isDragging = false;
  };

  const startNewGame = (config: GameConfig) => {
    stopConfetti();
    clearHints();
    generationError = null;
    boardScrollElement?.scrollTo(0, 0);
    boardScrollLeft = 0;
    boardScrollTop = 0;
    game = createGame(config);
    menuOpen = false;
    resultDismissed = false;
    elapsedSeconds = 0;
    startedAt = null;
  };

  const openMenu = () => {
    stopConfetti();
    clearHints();
    generationError = null;
    boardScrollElement?.scrollTo(0, 0);
    boardScrollLeft = 0;
    boardScrollTop = 0;
    game = createGame(game.config);
    menuOpen = true;
    resultDismissed = false;
    elapsedSeconds = 0;
    startedAt = null;
  };

  const updatePreview = () => {
    const config = setupConfig();
    if (gameConfigSchema.safeParse(config).success && setupCellCount <= LARGE_BOARD_WARNING_CELLS) {
      game = createGame(config);
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
    startNewGame(config);
  };

  const columnLabel = (index: number): string => {
    let position = index + 1;
    let label = '';
    while (position > 0) {
      position -= 1;
      label = COLUMN_LETTERS[position % COLUMN_LETTERS.length] + label;
      position = Math.floor(position / COLUMN_LETTERS.length);
    }
    return label;
  };

  const positionLabel = (index: number, config: GameConfig): string =>
    `row ${Math.floor(index / config.columns) + 1}, column ${columnLabel(index % config.columns)}`;

  const coordinateLabel = (index: number, config: GameConfig): string =>
    `${columnLabel(index % config.columns)}${Math.floor(index / config.columns) + 1}`;

  const coordinateList = (indices: readonly number[], config: GameConfig): string => {
    const coordinates = indices.map((index) => coordinateLabel(index, config));
    if (coordinates.length < 3) {
      return coordinates.join(' and ');
    }
    return `${coordinates.slice(0, -1).join(', ')}, and ${coordinates.at(-1)}`;
  };

  const cellLabel = (cell: Cell, index: number, currentGame: Game): string => {
    const position = positionLabel(index, currentGame.config);
    if (currentGame.phase === 'lost' && cell.mine) {
      return `${position}: mine`;
    }
    if (currentGame.phase === 'lost' && cell.flagged) {
      return `${position}: incorrect flag`;
    }
    if (cell.flagged) {
      return `${position}: flagged`;
    }
    if (!cell.revealed) {
      return `${position}: hidden`;
    }
    if (cell.adjacent === 0) {
      return `${position}: empty`;
    }
    return currentGame.phase === 'playing'
      ? `${position}: ${cell.adjacent} nearby mines. Activate to reveal unflagged neighbors when flags match.`
      : `${position}: ${cell.adjacent} nearby mines`;
  };

  const cellContent = (cell: Cell, currentGame: Game): string => {
    if (currentGame.phase === 'lost' && cell.flagged && !cell.mine) {
      return '×';
    }
    if (cell.flagged) {
      return '⚑';
    }
    if ((currentGame.phase === 'lost' && cell.mine) || (cell.revealed && cell.mine)) {
      return '✹';
    }
    if (cell.revealed && cell.adjacent > 0) {
      return String(cell.adjacent);
    }
    return '';
  };

  const hintAction = (hint: PlayableHint): string => {
    if (hint.kind === 'mine') {
      return game.flagsCount === game.config.mines ? 'Make room for a flag, then flag' : 'Flag';
    }
    return game.cells[hint.index].flagged ? 'Remove the flag, then reveal' : 'Reveal safely';
  };

  const countLabel = (count: number, noun: string): string =>
    `${count} ${noun}${count === 1 ? '' : 's'}`;
</script>

{#snippet hintCoordinate(index: number, role: HintRole)}
  <span
    class="hint-coordinate"
    data-hint-role={role}
    aria-label={positionLabel(index, game.config)}
  >
    {coordinateLabel(index, game.config)}
  </span>
{/snippet}

{#snippet hintCoordinates(indices: readonly number[], role: HintRole)}
  {#each indices as index, position (index)}
    {#if position > 0}{position === indices.length - 1 ? ' and ' : ', '}{/if}
    {@render hintCoordinate(index, role)}
  {/each}
{/snippet}

{#snippet constraintFact(clue: HintConstraint)}
  {@const accounted = game.cells[clue.clueIndex].adjacent - clue.mines}
  Clue {@render hintCoordinate(clue.clueIndex, 'clue')}
  {#if accounted > 0}
    already has {countLabel(accounted, 'mine')} accounted for and
  {/if}
  needs {countLabel(clue.mines, 'mine')} among {coordinateList(clue.cells, game.config)}.
{/snippet}

{#snippet hintExplanation(hint: PlayableHint)}
  {@const reason = hint.reason}
  {#if reason.kind === 'satisfied-clue'}
    {@render hintCoordinate(reason.clueIndex, 'clue')} shows {reason.mineCount}.
    {@render hintCoordinates(hint.references.provenMineIndices, 'proven-mine')}
    {reason.mineCount === 1 ? 'already accounts' : 'already account'} for
    {reason.mineCount === 1 ? 'its only mine' : `all ${reason.mineCount} mines`}. A mine at {@render hintCoordinate(
      hint.index,
      'target-safe',
    )} would make
    {reason.mineCount + 1} neighboring mines, contradicting that clue.
    {coordinateLabel(hint.index, game.config)} must be safe.
  {:else if reason.kind === 'clue'}
    {@const mineCount = game.cells[reason.clueIndex].adjacent}
    {@render hintCoordinate(reason.clueIndex, 'clue')} shows {mineCount}.
    {#if reason.remainingMines === 0}
      {#if reason.knownMines > 0}
        {@render hintCoordinates(hint.references.provenMineIndices, 'proven-mine')}
        {reason.knownMines === 1 ? 'already accounts' : 'already account'} for
        {mineCount === 1 ? 'its only mine' : `all ${mineCount} mines`}. A mine at {@render hintCoordinate(
          hint.index,
          'target-safe',
        )} would make
        {mineCount + 1} neighboring mines, contradicting that clue.
      {:else}
        None of its neighboring squares can contain a mine, including
        {@render hintCoordinate(hint.index, 'target-safe')}.
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
        {@render hintCoordinate(hint.index, 'proven-mine')}, so that square must be a mine.
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
{/snippet}

{#snippet board()}
  <div
    class="board"
    class:won={game.phase === 'won'}
    role="group"
    aria-label={`Minesweeper board, ${game.config.rows} rows and ${game.config.columns} columns${game.phase === 'won' ? ', won' : ''}`}
    style:grid-template-columns={`minmax(2rem, max-content) repeat(${game.config.columns}, minmax(0, 1fr))`}
    style:min-width={`${minBoardWidthPx}px`}
  >
    <span class="board-corner" aria-hidden="true">{game.phase === 'won' ? '✓' : ''}</span>
    {#each Array.from({ length: game.config.columns }, (_, index) => index) as column (column)}
      <span class="board-coordinate column-coordinate" aria-hidden="true">
        {columnLabel(column)}
      </span>
    {/each}
    {#each game.cells as cell, index (index)}
      {@const hintRole = activeHintRoles.get(index)}
      {#if index % game.config.columns === 0}
        <span class="board-coordinate row-coordinate" aria-hidden="true">
          {Math.floor(index / game.config.columns) + 1}
        </span>
      {/if}
      <button
        type="button"
        class="cell"
        class:revealed={cell.revealed || (game.phase === 'lost' && cell.mine)}
        class:flagged={cell.flagged}
        class:mine={game.phase === 'lost' && cell.mine}
        class:detonated={game.detonatedIndex === index}
        class:incorrect={game.phase === 'lost' && cell.flagged && !cell.mine}
        data-hint-role={hintRole}
        data-cell-index={index}
        data-adjacent={cell.revealed && !cell.mine ? cell.adjacent : undefined}
        aria-label={`${cellLabel(cell, index, game)}${hintRole ? `; hint: ${HINT_ROLE_LABELS[hintRole]}` : ''}`}
        title={hintRole
          ? `${coordinateLabel(index, game.config)} · ${HINT_ROLE_LABELS[hintRole]}`
          : undefined}
        aria-describedby={hintRole === 'wrong-flag'
          ? `flag-explanation-${index}`
          : activeHint?.index === index
            ? 'current-game-hint'
            : undefined}
        disabled={menuOpen ||
          game.phase === 'won' ||
          game.phase === 'lost' ||
          (cell.revealed && cell.adjacent === 0)}
        onclick={() => reveal(index)}
        oncontextmenu={(event) => {
          event.preventDefault();
          game = toggleFlag(game, index);
          clearHints();
        }}
      >
        <span aria-hidden="true">{cellContent(cell, game)}</span>
        {#if hintRole === 'wrong-flag'}
          <span class="wrong-flag-mark" aria-hidden="true">×</span>
        {/if}
      </button>
    {/each}
  </div>
{/snippet}

{#snippet setupMenu()}
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
      <CheckboxInput label="Solvable without guessing" bind:checked={setupNoGuessingRequired} />
      {#if setupCellCount > LARGE_BOARD_WARNING_CELLS}
        <p class="size-warning" role="status">
          Large board: {setupCellCount.toLocaleString()} squares. It may take longer to load and respond
          to moves.
        </p>
      {/if}
      <button type="submit" class="action start-game">Start game</button>
    </form>
  </div>
{/snippet}

<section class="game" aria-labelledby="games-title" style:max-width={`${gameWidthRem}rem`}>
  <div class="game-heading">
    <Heading level={2} id="games-title">Games</Heading>
  </div>

  <div class="scoreboard" class:pending={!storageReady} aria-label="Game progress">
    <span><strong>{minesLeft}</strong> mines left</span>
    {#if storageReady && !menuOpen && !showResultMessage}
      <button type="button" class="action" onclick={openMenu}>New game</button>
    {/if}
    <span><strong>{elapsedSeconds}</strong> seconds</span>
  </div>

  {#if storageReady && !menuOpen && game.phase === 'playing'}
    <div class="hint-area">
      <div class="hint-toolbar">
        <button type="button" class="action" onclick={showHints}>Hint</button>
        <button type="button" class="action" onclick={checkPlacedFlags}>Check flags</button>
      </div>
      {#if flagCheck !== null}
        <div class="hint-card">
          <p class="hint-heading" role="status">
            {#if flagCheck.flagsCount === 0}
              No flags placed yet.
            {:else if flagCheck.wrongFlags.length === 0}
              {flagCheck.flagsCount === 1
                ? 'Your flag is'
                : `All ${flagCheck.flagsCount} flags are`}
              correct.
            {:else if flagCheck.flagsCount === 1}
              Your flag is incorrect.
            {:else}
              {flagCheck.wrongFlags.length} of your {countLabel(flagCheck.flagsCount, 'flag')}
              {flagCheck.wrongFlags.length === 1 ? 'is' : 'are'} incorrect.
            {/if}
          </p>
          {#if flagCheck.wrongFlags.length > 0}
            {#if flagCheck.wrongFlags.length > 1}
              <p class="hint-explanation">
                Select a flag's coordinate to highlight its supporting clues.
              </p>
            {/if}
            <ul class="flag-check-list">
              {#each flagCheck.wrongFlags as flag (flag.index)}
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
                    {@render hintCoordinate(flag.index, 'wrong-flag')}
                  </button>
                  <div class="hint-explanation" id={`flag-explanation-${flag.index}`}>
                    {#if flag.hint}
                      {@const steps = hintProofSteps(flag.hint)}
                      {#if steps.length > 1}
                        <ol class="flag-proof">
                          {#each steps as step (step.index)}
                            <li>{@render hintExplanation(step)}</li>
                          {/each}
                        </ol>
                      {:else}
                        <p>{@render hintExplanation(flag.hint)}</p>
                      {/if}
                    {:else}
                      <p>
                        The board check confirms there is no mine here. No explanation from the
                        revealed clues is available yet.
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
                {@render hintCoordinate(
                  activeHint.index,
                  activeHint.kind === 'mine' ? 'target-mine' : 'target-safe',
                )}
              </p>
              <p class="hint-explanation">{@render hintExplanation(activeHint)}</p>
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
  {/if}

  {#if generationError}
    <p class="generation-error" role="alert">{generationError}</p>
  {/if}

  <div class="board-stage">
    <div
      bind:this={boardScrollElement}
      class="board-scroll"
      class:inactive={menuOpen || !storageReady}
      class:dragging={isDragging}
      role="region"
      aria-label="Scrollable game board"
      inert={menuOpen || !storageReady}
      onpointerdown={beginBoardDrag}
      onpointermove={moveBoardDrag}
      onpointerup={endBoardDrag}
      onpointercancel={endBoardDrag}
      onlostpointercapture={endBoardDrag}
      onpointerleave={() => {
        if (boardDrag && !boardDrag.dragging) boardDrag = undefined;
      }}
      onclickcapture={(event) => {
        if (suppressDraggedClick && event.detail !== 0) {
          event.preventDefault();
          event.stopPropagation();
          suppressDraggedClick = false;
        }
      }}
      onscroll={(event) => {
        boardScrollLeft = event.currentTarget.scrollLeft;
        boardScrollTop = event.currentTarget.scrollTop;
      }}
    >
      {@render board()}
    </div>
    {#if !storageReady}
      <div class="loading-overlay">
        <p class="loading-message" role="status">Loading game…</p>
      </div>
    {:else if menuOpen}
      <div class="menu-overlay">
        {@render setupMenu()}
      </div>
    {:else if showResultMessage}
      <div class="end-overlay">
        <div class="end-panel">
          <p class="end-message" role="status">
            {game.phase === 'won' ? 'You won!' : 'Game over — you hit a mine.'}
          </p>
          <div class="end-actions">
            <button type="button" class="action" onclick={openMenu}>New game</button>
            <button type="button" class="action" onclick={() => (resultDismissed = true)}>
              Dismiss message
            </button>
          </div>
        </div>
      </div>
    {/if}
  </div>
</section>

<style>
  .game {
    width: min(100%, calc(100vw - 3rem));
    min-width: 0;
    margin-block: clamp(3rem, 7vw, 6rem) 2rem;
    margin-inline: auto;
    font-family: system-ui, sans-serif;
  }

  .game-heading {
    margin-bottom: 1.5rem;
    text-align: center;
  }

  .board-stage {
    display: grid;
    min-width: 0;
  }

  .board-scroll,
  .menu-overlay,
  .loading-overlay,
  .end-overlay {
    grid-area: 1 / 1;
  }

  .board-scroll.inactive {
    max-height: 32rem;
    overflow: hidden;
    opacity: 0.6;
    filter: blur(1px);
    pointer-events: none;
  }

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

  .loading-overlay {
    z-index: 2;
    display: grid;
    place-items: center;
    padding: 1rem;
    background: light-dark(
      color-mix(in srgb, var(--color-50) 80%, transparent),
      color-mix(in srgb, var(--color-950) 80%, transparent)
    );
  }

  .loading-message {
    margin: 0;
    padding: 0.75rem 1rem;
    border: 1px solid var(--theme-border-color);
    border-radius: 0.5rem;
    background: light-dark(var(--color-50), var(--color-900));
    color: light-dark(var(--color-700), var(--color-300));
    font-size: 0.875rem;
    font-weight: 600;
  }

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
    box-shadow: 0 0.75rem 2rem rgb(0 0 0 / 0.15);
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

  .menu-panel {
    box-sizing: border-box;
    width: min(100%, 24rem);
    padding: 1rem;
    border: 1px solid var(--theme-border-color);
    border-radius: 0.5rem;
    background: light-dark(var(--color-50), var(--color-900));
    box-shadow: 0 0.75rem 2rem rgb(0 0 0 / 0.15);
  }

  .menu-panel h3 {
    margin: 0;
    color: light-dark(var(--color-950), var(--color-50));
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

  .generation-error {
    margin: 0 0 0.75rem;
    color: light-dark(var(--color-offset-120-700), var(--color-offset-120-300));
    font-size: 0.875rem;
  }

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
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
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

  .board-scroll {
    max-width: 100%;
    max-height: 70rem;
    min-width: 0;
    overflow: auto;
    scrollbar-width: thin;
    cursor: grab;
  }

  .board-scroll.dragging,
  .board-scroll.dragging .cell {
    cursor: grabbing;
  }

  .board {
    --board-surface: light-dark(var(--color-200), var(--color-800));

    display: grid;
    gap: 3px;
    width: 100%;
    box-sizing: border-box;
    padding: 3px;
    border: 1px solid var(--theme-border-color);
    border-radius: 0.5rem;
    background: var(--board-surface);
    user-select: none;
  }

  .board.won {
    --board-surface: light-dark(
      color-mix(in srgb, var(--color-complement-300) 40%, var(--color-200)),
      color-mix(in srgb, var(--color-complement-700) 40%, var(--color-800))
    );

    border-color: light-dark(var(--color-complement-600), var(--color-complement-400));
    box-shadow: 0 0 0 2px light-dark(var(--color-complement-300), var(--color-complement-700));
  }

  .board.won .board-corner {
    display: grid;
    place-items: center;
    color: light-dark(var(--color-complement-700), var(--color-complement-300));
    font-size: 1.125rem;
    font-weight: 700;
  }

  .board-corner,
  .board-coordinate {
    background: var(--board-surface);
    box-shadow: 0 0 0 2px var(--board-surface);
  }

  .board-corner {
    position: sticky;
    z-index: 3;
    top: 0;
    left: 0;
  }

  .column-coordinate {
    position: sticky;
    z-index: 2;
    top: 0;
  }

  .row-coordinate {
    position: sticky;
    z-index: 1;
    left: 0;
  }

  .board-coordinate {
    display: grid;
    place-items: center;
    min-width: 0;
    padding-inline: 0.25rem;
    color: light-dark(var(--color-700), var(--color-300));
    font-size: 0.75rem;
    font-weight: 600;
    font-variant-numeric: tabular-nums;
    line-height: 1;
  }

  .cell {
    position: relative;
    display: grid;
    place-items: center;
    min-width: 0;
    aspect-ratio: 1;
    padding: 0;
    border: 1px solid var(--theme-border-color);
    border-radius: 0.25rem;
    background: light-dark(var(--color-50), var(--color-900));
    color: light-dark(var(--color-700), var(--color-300));
    font:
      700 clamp(0.875rem, 3vw, 1.25rem) / 1 system-ui,
      sans-serif;
    cursor: pointer;
    touch-action: manipulation;
  }

  .cell:not(:disabled):hover {
    background: light-dark(var(--color-100), var(--color-800));
  }

  .cell:focus-visible,
  .action:focus-visible,
  .flag-location:focus-visible {
    outline: 2px solid light-dark(var(--color-600), var(--color-300));
    outline-offset: 2px;
    z-index: 1;
  }

  .cell:disabled {
    opacity: 1;
    cursor: default;
  }

  .cell.revealed {
    border-color: transparent;
    background: light-dark(var(--color-100), var(--color-950));
  }

  .cell.flagged {
    color: light-dark(var(--color-complement-700), var(--color-complement-300));
  }

  .board.won .cell.flagged {
    border-color: light-dark(var(--color-complement-400), var(--color-complement-600));
    background: light-dark(var(--color-complement-100), var(--color-complement-900));
  }

  .cell.mine,
  .cell.incorrect {
    color: light-dark(var(--color-offset-120-700), var(--color-offset-120-300));
  }

  .cell.detonated {
    background: light-dark(var(--color-offset-120-100), var(--color-offset-120-900));
  }

  :where(.cell, .hint-coordinate, .hint-swatch)[data-hint-role='target-mine'] {
    --hint-stroke: light-dark(oklch(0.47 0.18 25), oklch(0.8 0.14 25));
    --hint-fill: light-dark(oklch(0.94 0.035 25), oklch(0.31 0.055 25));
  }

  :where(.cell, .hint-coordinate, .hint-swatch)[data-hint-role='wrong-flag'] {
    --hint-stroke: light-dark(oklch(0.47 0.18 25), oklch(0.8 0.14 25));
    --hint-fill: light-dark(oklch(0.94 0.035 25), oklch(0.31 0.055 25));
  }

  .cell[data-hint-role='wrong-flag'] {
    color: var(--hint-stroke);
  }

  .wrong-flag-mark {
    position: absolute;
    top: 0.1rem;
    right: 0.15rem;
    font-size: 0.75rem;
  }

  :where(.cell, .hint-coordinate, .hint-swatch)[data-hint-role='target-safe'] {
    --hint-stroke: light-dark(oklch(0.43 0.14 145), oklch(0.78 0.15 145));
    --hint-fill: light-dark(oklch(0.94 0.035 145), oklch(0.3 0.055 145));
  }

  :where(.cell, .hint-coordinate, .hint-swatch)[data-hint-role='clue'] {
    --hint-stroke: light-dark(oklch(0.43 0.15 245), oklch(0.79 0.11 245));
    --hint-fill: light-dark(oklch(0.94 0.035 245), oklch(0.3 0.055 245));
  }

  :where(.cell, .hint-coordinate, .hint-swatch)[data-hint-role='proven-mine'] {
    --hint-stroke: light-dark(oklch(0.45 0.13 75), oklch(0.82 0.13 75));
    --hint-fill: light-dark(oklch(0.95 0.04 75), oklch(0.31 0.055 75));
  }

  :where(.cell, .hint-coordinate, .hint-swatch)[data-hint-role='proven-safe'] {
    --hint-stroke: light-dark(oklch(0.42 0.12 190), oklch(0.79 0.11 190));
    --hint-fill: light-dark(oklch(0.94 0.035 190), oklch(0.3 0.055 190));
  }

  :where(.cell, .hint-coordinate, .hint-swatch)[data-hint-role='undecided'] {
    --hint-stroke: light-dark(oklch(0.48 0.15 305), oklch(0.8 0.12 305));
    --hint-fill: light-dark(oklch(0.95 0.035 305), oklch(0.31 0.055 305));
  }

  .cell[data-hint-role],
  .cell[data-hint-role]:not(:disabled):hover {
    border-color: var(--hint-stroke);
    background: var(--hint-fill);
    z-index: 1;
  }

  .cell[data-hint-role='undecided'],
  .cell[data-hint-role='undecided']:not(:disabled):hover {
    border-color: var(--theme-border-color);
  }

  .cell[data-hint-role^='target-'] {
    outline: 2px solid var(--hint-stroke);
    outline-offset: 1px;
    z-index: 2;
  }

  .cell[data-adjacent='2'],
  .cell[data-adjacent='5'],
  .cell[data-adjacent='8'] {
    color: light-dark(var(--color-offset-120-700), var(--color-offset-120-300));
  }

  .cell[data-adjacent='3'],
  .cell[data-adjacent='6'] {
    color: light-dark(var(--color-offset-240-700), var(--color-offset-240-300));
  }

  .action {
    min-height: 2.5rem;
    padding: 0.5rem 0.875rem;
    border: 1px solid var(--theme-border-color);
    border-radius: 0.375rem;
    background: light-dark(var(--color-50), var(--color-900));
    color: light-dark(var(--color-700), var(--color-300));
    font:
      500 0.875rem / 1.25 system-ui,
      sans-serif;
    cursor: pointer;
  }

  .action:hover,
  .action.active {
    background: light-dark(var(--color-100), var(--color-800));
    color: light-dark(var(--color-950), var(--color-50));
  }
</style>
