import assert from 'node:assert/strict';
import { test } from 'node:test';

import { validateIsSolvable } from '$/lib/minesweeper/constraint-solving/find-solvable-games';
import { type GameConfig, createGame, minesForDifficulty, revealCell } from '$lib/minesweeper/game';
import {
  type SavedGameState,
  readSavedGameState,
  serializeGameState,
} from '$lib/minesweeper/persistence';

const cellsWithMines = (rows: number, columns: number, mineIndices: readonly number[]) => {
  const mines = new Set(mineIndices);
  return Array.from({ length: rows * columns }, (_, index) => {
    const row = Math.floor(index / columns);
    const column = index % columns;
    let adjacent = 0;
    for (let rowOffset = -1; rowOffset <= 1; rowOffset += 1) {
      for (let columnOffset = -1; columnOffset <= 1; columnOffset += 1) {
        const nextRow = row + rowOffset;
        const nextColumn = column + columnOffset;
        if (
          (rowOffset !== 0 || columnOffset !== 0) &&
          nextRow >= 0 &&
          nextRow < rows &&
          nextColumn >= 0 &&
          nextColumn < columns &&
          mines.has(nextRow * columns + nextColumn)
        ) {
          adjacent += 1;
        }
      }
    }
    return { adjacent, flagged: false, mine: mines.has(index), revealed: false };
  });
};

const randomFromSeed = (seed: number): (() => number) => {
  let state = seed;
  return () => {
    state = (Math.imul(state, 1_664_525) + 1_013_904_223) >>> 0;
    return state / 0x1_0000_0000;
  };
};

void test('the solver accepts a forced board and rejects an ambiguous board', () => {
  const config: GameConfig = { columns: 5, mines: 2, noGuessingRequired: true, rows: 5 };
  assert.equal(validateIsSolvable(cellsWithMines(5, 5, [0, 24]), config, 12), true);
  assert.equal(validateIsSolvable(cellsWithMines(5, 5, [0, 3]), config, 12), false);
});

void test('generated preset boards are safe on the first click and certified without guessing', () => {
  for (const [size, difficulty] of [
    [8, 'easy'],
    [12, 'medium'],
    [16, 'hard'],
  ] as const) {
    const config: GameConfig = {
      columns: size,
      mines: minesForDifficulty(difficulty, size, size),
      noGuessingRequired: true,
      rows: size,
    };
    for (let seed = 1; seed <= 6; seed += 1) {
      const startIndex = Math.floor((size * size) / 2) + seed - 3;
      const game = revealCell(createGame(config), startIndex, randomFromSeed(seed));
      assert.equal(game.cells.filter((cell) => cell.mine).length, config.mines);
      assert.equal(game.cells[startIndex].adjacent, 0);
      assert.equal(game.cells[startIndex].revealed, true);
      assert.equal(validateIsSolvable(game.cells, config, startIndex), true);
    }
  }
});

void test('older saved games retain ordinary random mode', () => {
  const game = createGame();
  const state: SavedGameState = {
    difficulty: 'easy',
    elapsedSeconds: 0,
    game,
    menuOpen: false,
    scrollLeft: 0,
    scrollTop: 0,
    setup: game.config,
  };
  const old = {
    ...state,
    game: {
      ...game,
      config: { columns: game.config.columns, mines: game.config.mines, rows: game.config.rows },
    },
    savedAt: 1000,
    setup: { columns: game.config.columns, mines: game.config.mines, rows: game.config.rows },
    version: 1,
  };
  const restored = readSavedGameState(JSON.stringify(old), 1000);
  assert.ok(restored);
  assert.equal(restored.game.config.noGuessingRequired, false);
  assert.equal(restored.setup.noGuessingRequired, false);
});

void test('saved games round trip and reject inconsistent board state', () => {
  const game = createGame();
  const state: SavedGameState = {
    difficulty: 'easy',
    elapsedSeconds: 0,
    game,
    menuOpen: true,
    scrollLeft: 0,
    scrollTop: 0,
    setup: game.config,
  };
  const raw = serializeGameState(state, 1000);
  assert.deepEqual(readSavedGameState(raw, 1000), state);

  const inconsistent = structuredClone(state);
  inconsistent.game.flagsCount = 1;
  assert.equal(readSavedGameState(serializeGameState(inconsistent, 1000), 1000), null);

  inconsistent.game.flagsCount = 0;
  inconsistent.game.cells[0].mine = true;
  assert.equal(readSavedGameState(serializeGameState(inconsistent, 1000), 1000), null);
});
