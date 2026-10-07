import { type Moves, type State, nextMoves } from '#lib/minesweeper/constraint-solving/core.js';
import {
  DEFAULT_SEARCH_SETTINGS,
  type SearchProgress,
} from '#lib/minesweeper/constraint-solving/search-settings.js';
import type { Cell, GameConfig } from '#lib/minesweeper/game.js';
import { neighborsOf } from '#lib/minesweeper/neighbors.js';

/** Reveal safe cells and expand empty regions, returning false if a mine is encountered. */
const openSafeCells = (state: State, indices: readonly number[]): boolean => {
  const pending = [...indices];
  while (pending.length > 0) {
    const index = pending.pop();
    if (index === undefined || state.revealed[index]) {
      continue;
    }
    if (state.cells[index].mine || state.knownMines[index]) {
      return false;
    }
    state.revealed[index] = 1;
    state.revealedCount += 1;
    if (state.cells[index].adjacent === 0) {
      pending.push(...state.neighbors[index]);
    }
  }
  return true;
};

/** Mark deduced mines and reveal deduced safe cells, rejecting moves that contradict the board. */
const applyMoves = (state: State, moves: Moves): boolean => {
  for (const index of moves.mines) {
    if (state.revealed[index] || !state.cells[index].mine) {
      return false;
    }
    state.knownMines[index] = 1;
  }
  return openSafeCells(state, moves.safe);
};

/** Check whether forced deductions solve the board from the starting cell (Kunz 2024, section 3.3). */
export const validateIsSolvable = (
  cells: readonly Cell[],
  config: GameConfig,
  startIndex: number,
): boolean => {
  const state: State = {
    cells,
    knownMines: new Uint8Array(cells.length),
    knownSafe: new Uint8Array(cells.length),
    neighbors: Array.from({ length: cells.length }, (_, index) => neighborsOf(index, config)),
    revealed: new Uint8Array(cells.length),
    revealedCount: 0,
  };
  if (!openSafeCells(state, [startIndex])) {
    return false;
  }
  while (state.revealedCount < cells.length - config.mines) {
    const moves = nextMoves(state, config);
    if (
      !moves ||
      (moves.safe.length === 0 && moves.mines.length === 0) ||
      !applyMoves(state, moves)
    ) {
      return false;
    }
  }
  return true;
};

/** Generate a random board, requiring a solvable candidate when no-guess mode is enabled. */
export const placeMines = (
  cells: Cell[],
  safeIndex: number,
  config: GameConfig,
  random: () => number,
  onProgress?: (progress: SearchProgress) => void,
): Cell[] => {
  if (!config.noGuessingRequired) {
    return placeMinesOnce(cells, safeIndex, config, random);
  }

  // Kunz (2024), section 3.4: random candidates first, then iterative mine placement.
  const settings = config.searchSettings ?? DEFAULT_SEARCH_SETTINGS;
  const startedAt = Date.now();
  const randomDeadline = startedAt + settings.randomTimeLimitMs;
  let boardsChecked = 0;
  const report = (phase: SearchProgress['phase'], minesPlaced: number) => {
    onProgress?.({ boardsChecked, elapsedMs: Date.now() - startedAt, minesPlaced, phase });
  };
  report('random', 0);
  for (
    let attempts = 0;
    attempts < settings.maxRandomAttempts && Date.now() < randomDeadline;
    ++attempts
  ) {
    cells = placeMinesOnce(cells, safeIndex, config, random);
    const solvable = validateIsSolvable(cells, config, safeIndex);
    boardsChecked += 1;
    report('random', config.mines);
    if (solvable) {
      return cells;
    }
  }
  report('iterative', 0);
  return placeMinesIteratively(cells, safeIndex, config, random, (mines) => {
    boardsChecked += 1;
    report('iterative', mines);
  });
};

/** Copy the cells with the chosen mine positions and recalculated adjacent mine counts. */
const boardWithMines = (
  cells: Cell[],
  config: GameConfig,
  mineIndices: ReadonlySet<number>,
): Cell[] =>
  cells.map((cell, index) => ({
    ...cell,
    adjacent: neighborsOf(index, config).filter((neighbor) => mineIndices.has(neighbor)).length,
    mine: mineIndices.has(index),
  }));

/** Add mines while preserving solvability, retrying until a complete board is found. */
const placeMinesIteratively = (
  cells: Cell[],
  safeIndex: number,
  config: GameConfig,
  random: () => number,
  onCandidate: (minesPlaced: number) => void,
): Cell[] => {
  const excluded = new Set([safeIndex, ...neighborsOf(safeIndex, config)]);
  const candidates = cells.map((_, index) => index).filter((index) => !excluded.has(index));
  let available = [...candidates];
  let rejected: number[] = [];
  let mines = new Set<number>();
  while (true) {
    if (available.length === 0) {
      available = [...candidates];
      rejected = [];
      mines = new Set<number>();
    }
    const choice = Math.floor(random() * available.length);
    const [index] = available.splice(choice, 1);
    mines.add(index);
    const candidate = boardWithMines(cells, config, mines);
    const solvable = validateIsSolvable(candidate, { ...config, mines: mines.size }, safeIndex);
    onCandidate(solvable ? mines.size : mines.size - 1);
    if (solvable) {
      if (mines.size === config.mines) {
        return candidate;
      }
      available.push(...rejected);
      rejected = [];
    } else {
      mines.delete(index);
      rejected.push(index);
    }
  }
};

/** Randomly place mines outside the starting cell and its neighbors. */
const placeMinesOnce = (
  cells: Cell[],
  safeIndex: number,
  config: GameConfig,
  random: () => number,
): Cell[] => {
  const safeIndices = new Set([safeIndex, ...neighborsOf(safeIndex, config)]);
  const candidates = cells.map((_, index) => index).filter((index) => !safeIndices.has(index));

  for (let index = candidates.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [candidates[index], candidates[swapIndex]] = [candidates[swapIndex], candidates[index]];
  }

  return boardWithMines(cells, config, new Set(candidates.slice(0, config.mines)));
};
