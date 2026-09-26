import type { Cell, GameConfig } from '$lib/minesweeper/game';
import { neighborsOf } from '$lib/minesweeper/neighbors';
import { type Moves, type State, nextMoves } from '$lib/minesweeper/constraint-solving/core';

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
): Cell[] => {
  if (!config.noGuessingRequired) {
    return placeMinesOnce(cells, safeIndex, config, random);
  }

  // Kunz (2024), section 3.4: random candidates first, then iterative mine placement.
  const deadline = Date.now() + 1500;
  const randomDeadline = Date.now() + 400;
  for (let attempts = 0; attempts < 1000 && Date.now() < randomDeadline; attempts += 1) {
    cells = placeMinesOnce(cells, safeIndex, config, random);
    if (validateIsSolvable(cells, config, safeIndex)) {
      return cells;
    }
  }
  const iterative = placeMinesIteratively(cells, safeIndex, config, random, deadline);
  if (iterative) {
    return iterative;
  }
  throw new Error('Could not create a no-guess board. Try fewer mines or turn off no-guess mode.');
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

/** Add mines while preserving solvability and the safe opening, retrying until the deadline. */
const placeMinesIteratively = (
  cells: Cell[],
  safeIndex: number,
  config: GameConfig,
  random: () => number,
  deadline: number,
): Cell[] | null => {
  const excluded = new Set([safeIndex, ...neighborsOf(safeIndex, config)]);
  const candidates = cells.map((_, index) => index).filter((index) => !excluded.has(index));
  let available = [...candidates];
  let rejected: number[] = [];
  let mines = new Set<number>();
  while (Date.now() < deadline) {
    if (available.length === 0) {
      available = [...candidates];
      rejected = [];
      mines = new Set<number>();
    }
    const choice = Math.floor(random() * available.length);
    const [index] = available.splice(choice, 1);
    mines.add(index);
    const candidate = boardWithMines(cells, config, mines);
    if (validateIsSolvable(candidate, { ...config, mines: mines.size }, safeIndex)) {
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
  return null;
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
