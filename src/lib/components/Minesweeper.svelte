<script lang="ts">
  import Board from '$lib/components/minesweeper/Board.svelte';
  import HintPanel from '$lib/components/minesweeper/HintPanel.svelte';
  import {
    HINT_ROLE_LABELS,
    HINT_ROLE_ORDER,
    type HintRole,
  } from '$lib/components/minesweeper/presentation';
  import ResultOverlay from '$lib/components/minesweeper/ResultOverlay.svelte';
  import Scoreboard from '$lib/components/minesweeper/Scoreboard.svelte';
  import SearchOverlay from '$lib/components/minesweeper/SearchOverlay.svelte';
  import SetupMenu from '$lib/components/minesweeper/SetupMenu.svelte';

  import '$lib/components/minesweeper/shared.css';
  import { Heading } from '$lib/components/typography';
  import { type FlagCheck, type FlagCheckMode, checkFlags } from '$lib/minesweeper/check-flags';
  import {
    type PlayableHint,
    findPlayableHints,
    hintProofSteps,
  } from '$lib/minesweeper/constraint-solving/generate-hints';
  import { startSolvableGameSearch } from '$lib/minesweeper/constraint-solving/search-client';
  import {
    DEFAULT_SEARCH_SETTINGS,
    type SearchProgress,
    type SearchSettings,
  } from '$lib/minesweeper/constraint-solving/search-settings';
  import {
    BOARD_SIZES,
    type Difficulty,
    type Game,
    type GameConfig,
    createGame,
    gameConfigSchema,
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
  import { readThemeColors } from '$lib/theme/colors';
  import { onMount, untrack } from 'svelte';
  import { on } from 'svelte/events';
  import { SvelteMap } from 'svelte/reactivity';

  const MILLISECONDS_PER_SECOND = 1000;
  const SAVE_INTERVAL_MS = 10_000;
  const SEARCH_SCREEN_DELAY_MS = 500;
  const CONFETTI_BURST_INTERVAL_MS = 1700;
  const CONFETTI_BURST_COUNT = 3;

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
  let setupSearchSettings = $state<SearchSettings>({ ...DEFAULT_SEARCH_SETTINGS });
  let generationError = $state<string | null>(null);
  let searching = $state(false);
  let showSearchScreen = $state(false);
  let searchElapsedMs = $state(0);
  let searchProgress = $state<SearchProgress | null>(null);
  let cancelSearch: (() => void) | undefined;
  let playRandomBoard: (() => void) | undefined;
  let elapsedSeconds = $state(0);
  let storageReady = $state(false);
  let startedAt: number | null = null;
  let lastSavedAt = 0;
  let confettiRun = 0;
  let confettiInterval: number | undefined;
  let activeConfetti: { reset: () => void } | undefined;
  let board: Board | undefined;
  let scrollToRestore = $state<{ left: number; top: number } | null>(null);
  const scrollToCell = (index: number | undefined) => board?.scrollToCell(index);
  let boardScrollLeft = 0;
  let boardScrollTop = 0;
  let hints = $state<PlayableHint[] | null>(null);
  let hintCursor = $state(0);
  let showHintDetails = $state(false);
  let flagCheck = $state<FlagCheck | null>(null);
  let flagCheckMode = $state<FlagCheckMode>('proof');
  let selectedFlagIndex = $state<number | null>(null);

  const minesLeft = $derived(game.config.mines - game.flagsCount);
  const gameEnded = $derived(game.phase === 'won' || game.phase === 'lost');
  const showResultMessage = $derived(gameEnded && !resultDismissed);
  const activeHint = $derived(hints?.[hintCursor] ?? null);
  const selectedFlagHint = $derived(
    flagCheck?.flags.find((flag) => flag.index === selectedFlagIndex)?.hint ?? null,
  );
  const checkedFlagsToShow = $derived(
    flagCheck?.flags.filter((flag) => flag.status === 'incorrect') ?? [],
  );
  const activeHintRoles = $derived.by(() => {
    const roles = new SvelteMap<number, HintRole>();
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
    for (const flag of checkedFlagsToShow) {
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
  const currentElapsedSeconds = () =>
    game.phase === 'playing' && startedAt !== null
      ? Math.floor((Date.now() - startedAt) / MILLISECONDS_PER_SECOND)
      : elapsedSeconds;

  const setupConfig = (): GameConfig => ({
    columns: setupColumns,
    mines: setupMines,
    noGuessingRequired: setupNoGuessingRequired,
    rows: setupRows,
    searchSettings: setupNoGuessingRequired ? { ...setupSearchSettings } : undefined,
  });

  const currentSavedState = (seconds: number): SavedGameState => {
    const setup = setupConfig();
    return {
      difficulty,
      elapsedSeconds: seconds,
      flagCheckMode,
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
        setupSearchSettings = { ...(saved.setup.searchSettings ?? DEFAULT_SEARCH_SETTINGS) };
        elapsedSeconds = saved.elapsedSeconds;
        flagCheckMode = saved.flagCheckMode;
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
      cancelSearch?.();
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
          colors: readThemeColors([
            '--color-500',
            '--color-complement-500',
            '--color-offset-120-500',
            '--color-offset-240-500',
          ]),
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

  const showHints = () => {
    clearHints();
    hints = findPlayableHints(game);
    hintCursor = 0;
    showHintDetails = false;
    scrollToCell(hints[0]?.index);
  };

  const checkPlacedFlags = () => {
    clearHints();
    flagCheck = checkFlags(game, flagCheckMode);
    const firstFlag = flagCheck?.flags.find((flag) => flag.status === 'incorrect');
    selectedFlagIndex = firstFlag?.index ?? null;
    scrollToCell(firstFlag?.index);
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

  const reveal = async (index: number) => {
    if (searching || menuOpen || game.cells[index].flagged) {
      return;
    }
    let next: Game;
    try {
      if (game.phase === 'ready' && game.config.noGuessingRequired) {
        searching = true;
        generationError = null;
        searchProgress = null;
        searchElapsedMs = 0;
        const searchStartedAt = Date.now();
        const screenDelay = window.setTimeout(() => {
          showSearchScreen = true;
          searchElapsedMs = Date.now() - searchStartedAt;
        }, SEARCH_SCREEN_DELAY_MS);
        const elapsedInterval = window.setInterval(() => {
          searchElapsedMs = Date.now() - searchStartedAt;
        }, 100);
        try {
          const search = startSolvableGameSearch($state.snapshot(game), index, (progress) => {
            searchProgress = progress;
          });
          cancelSearch = search.cancel;
          playRandomBoard = search.useRandomBoard;
          const found = await search.result;
          if (!found) {
            return;
          }
          next = found;
        } finally {
          window.clearTimeout(screenDelay);
          window.clearInterval(elapsedInterval);
          cancelSearch = undefined;
          playRandomBoard = undefined;
          searching = false;
          showSearchScreen = false;
        }
      } else {
        next = game.cells[index].revealed
          ? revealAdjacentCells(game, index)
          : revealCell(game, index);
      }
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
    void reveal(hint.index);
  };

  const flagCell = (index: number) => {
    if (searching || menuOpen) {
      return;
    }
    game = toggleFlag(game, index);
    clearHints();
  };

  const startNewGame = (config: GameConfig) => {
    cancelSearch?.();
    stopConfetti();
    clearHints();
    generationError = null;
    scrollToRestore = { left: 0, top: 0 };
    boardScrollLeft = 0;
    boardScrollTop = 0;
    game = createGame(config);
    menuOpen = false;
    resultDismissed = false;
    elapsedSeconds = 0;
    startedAt = null;
  };

  const openMenu = () => {
    cancelSearch?.();
    stopConfetti();
    clearHints();
    generationError = null;
    scrollToRestore = { left: 0, top: 0 };
    boardScrollLeft = 0;
    boardScrollTop = 0;
    game = createGame(game.config);
    menuOpen = true;
    resultDismissed = false;
    elapsedSeconds = 0;
    startedAt = null;
  };
</script>

<section class="game" aria-labelledby="games-title" style:max-width={`${gameWidthRem}rem`}>
  <div class="game-heading"><Heading level={2} id="games-title">Games</Heading></div>
  <Scoreboard
    {minesLeft}
    {elapsedSeconds}
    pending={!storageReady}
    showNewGame={storageReady && !menuOpen && !showResultMessage}
    onnewgame={openMenu}
  />
  {#if storageReady && !menuOpen && game.phase === 'playing'}
    <HintPanel
      {game}
      {hints}
      {hintCursor}
      {flagCheck}
      bind:flagCheckMode
      bind:selectedFlagIndex
      bind:showHintDetails
      {activeHintLegend}
      {showHints}
      {checkPlacedFlags}
      {clearHints}
      {scrollToCell}
      {performHint}
      {nextHint}
      {lastHint}
    />
  {/if}
  {#if generationError}<p class="generation-error" role="alert">{generationError}</p>{/if}
  <div class="board-stage">
    <Board
      bind:this={board}
      {game}
      {menuOpen}
      {storageReady}
      {searching}
      {showSearchScreen}
      {activeHintRoles}
      activeHintIndex={activeHint?.index}
      {scrollToRestore}
      onreveal={(index) => void reveal(index)}
      onflag={flagCell}
      onscrollposition={(left, top) => {
        boardScrollLeft = left;
        boardScrollTop = top;
      }}
    />
    {#if !storageReady}
      <div class="loading-overlay"><p class="loading-message" role="status">Loading game…</p></div>
    {:else if showSearchScreen}
      <SearchOverlay
        config={game.config}
        {searchProgress}
        {searchElapsedMs}
        onrandom={() => playRandomBoard?.()}
        onback={openMenu}
      />
    {:else if menuOpen}
      <SetupMenu
        bind:difficulty
        bind:setupRows
        bind:setupColumns
        bind:setupMines
        bind:setupNoGuessingRequired
        bind:setupSearchSettings
        onstart={startNewGame}
        onpreview={(config) => {
          game = createGame(config);
        }}
      />
    {:else if showResultMessage}
      <ResultOverlay
        won={game.phase === 'won'}
        onnewgame={openMenu}
        ondismiss={() => {
          resultDismissed = true;
        }}
      />
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

  .generation-error {
    margin: 0 0 0.75rem;
    color: light-dark(var(--color-offset-120-700), var(--color-offset-120-300));
    font-size: 0.875rem;
  }
</style>
