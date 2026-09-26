import assert from 'node:assert/strict';
import { test } from 'node:test';

import { validateIsSolvable } from '$/lib/minesweeper/constraint-solving/find-solvable-games';
import {
  findPlayableHints,
  hintProofSteps,
} from '$/lib/minesweeper/constraint-solving/generate-hints';
import { checkFlags } from '$lib/minesweeper/check-flags';
import {
  type Game,
  type GameConfig,
  createGame,
  minesForDifficulty,
  revealCell,
  toggleFlag,
} from '$lib/minesweeper/game';
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

void test('hints use visible clues, remain safe with a wrong flag, and explain each move', () => {
  const config: GameConfig = {
    columns: 8,
    mines: minesForDifficulty('easy', 8, 8),
    noGuessingRequired: true,
    rows: 8,
  };
  const game = revealCell(createGame(config), 36, randomFromSeed(1));
  const hints = findPlayableHints(game);
  assert.ok(hints.length > 1);
  assert.equal(new Set(hints.map(({ index }) => index)).size, hints.length);
  for (const hint of hints) {
    const steps = hintProofSteps(hint);
    const proven = new Set<number>();
    for (const step of steps) {
      assert.ok(step.prerequisites.every((prerequisite) => proven.has(prerequisite.index)));
      assert.ok(!proven.has(step.index));
      proven.add(step.index);
    }
    assert.equal(steps.at(-1)?.index, hint.index);
    assert.equal(game.cells[hint.index].revealed, false);
    assert.equal(game.cells[hint.index].mine, hint.kind === 'mine');
    assert.ok(hint.references.undecidedIndices.includes(hint.index));
    assert.ok(hint.references.provenMineIndices.every((index) => game.cells[index].mine));
    assert.ok(hint.references.provenSafeIndices.every((index) => !game.cells[index].mine));
    if (hint.reason.kind === 'clue') {
      assert.equal(game.cells[hint.reason.clueIndex].revealed, true);
      assert.deepEqual(hint.references.clueIndices, [hint.reason.clueIndex]);
      assert.equal(hint.references.provenMineIndices.length, hint.reason.knownMines);
      assert.equal(hint.references.provenSafeIndices.length, hint.reason.knownSafe);
      assert.equal(hint.references.undecidedIndices.length, hint.reason.unknownNeighbors);
      if (hint.kind === 'safe') {
        assert.equal(hint.reason.remainingMines, 0);
      } else {
        assert.equal(hint.reason.remainingMines, hint.reason.unknownNeighbors);
      }
    } else if (hint.reason.kind === 'constraints') {
      assert.ok(hint.reason.clueIndices.length > 0);
      assert.ok(hint.reason.clueIndices.every((index) => game.cells[index].revealed));
      assert.deepEqual(hint.references.clueIndices, hint.reason.clueIndices);
    }
  }

  const obscured = structuredClone(game);
  for (const cell of obscured.cells) {
    if (!cell.revealed) {
      cell.mine = !cell.mine;
    }
  }
  assert.deepEqual(findPlayableHints(obscured), hints);

  const safeHint = hints.find(({ kind }) => kind === 'safe');
  assert.ok(safeHint);
  const wrongFlag = structuredClone(game);
  wrongFlag.cells[safeHint.index].flagged = true;
  wrongFlag.flagsCount += 1;
  assert.deepEqual(findPlayableHints(wrongFlag), hints);
});

void test('flag checks find every incorrect flag, including those with no visible deduction', () => {
  const config: GameConfig = { columns: 5, mines: 3, noGuessingRequired: false, rows: 5 };
  const cells = cellsWithMines(5, 5, [0, 6, 24]);
  cells[12].revealed = true;
  const base: Game = {
    cells,
    config,
    detonatedIndex: null,
    flagsCount: 0,
    phase: 'playing',
    revealedCount: 1,
  };
  for (const [flags, wrong] of [
    [[], []],
    [[0, 6], []],
    [
      [0, 4, 20],
      [4, 20],
    ],
  ] as const) {
    const game = { ...base, cells: cells.map((cell) => ({ ...cell })), flagsCount: flags.length };
    for (const index of flags) {
      game.cells[index].flagged = true;
    }
    const before = structuredClone(game);
    assert.deepEqual(checkFlags(game), {
      flagsCount: flags.length,
      wrongFlags: wrong.map((index) => ({ hint: null, index })),
    });
    assert.deepEqual(game, before);
  }
  assert.equal(checkFlags(toggleFlag(createGame(config), 4)), null);
});

void test('incorrect flags include safe deductions without changing flags or revealing cells', () => {
  const game = revealCell(createGame(), 36, randomFromSeed(1));
  const safe = findPlayableHints(game)
    .filter((hint) => hint.kind === 'safe')
    .slice(0, 2);
  assert.equal(safe.length, 2);
  const mineIndex = game.cells.findIndex((cell) => cell.mine);
  assert.ok(mineIndex >= 0);
  const flagged = [mineIndex, ...safe.map((hint) => hint.index)].reduce(
    (current, index) => toggleFlag(current, index),
    game,
  );
  const before = structuredClone(flagged);
  const result = checkFlags(flagged);
  assert.ok(result);
  assert.equal(result.flagsCount, 3);
  assert.deepEqual(
    result.wrongFlags.map((flag) => flag.index).toSorted((left, right) => left - right),
    safe.map((hint) => hint.index).toSorted((left, right) => left - right),
  );
  for (const flag of result.wrongFlags) {
    assert.ok(flag.hint);
    assert.equal(flag.hint.kind, 'safe');
    assert.equal(flag.hint.index, flag.index);
    assert.ok(flag.hint.references.undecidedIndices.includes(flag.index));
    assert.ok(flag.hint.references.clueIndices.every((index) => game.cells[index].revealed));
  }
  assert.deepEqual(flagged, before);
});

void test('a satisfied clue explains safe neighbors only when its flags are proven mines', () => {
  const config: GameConfig = { columns: 3, mines: 2, noGuessingRequired: false, rows: 3 };
  const cells = cellsWithMines(3, 3, [0, 2]);
  cells.forEach((cell, index) => {
    cell.revealed = !cell.mine && index !== 4;
    cell.flagged = index === 0 || index === 2;
  });
  const game: Game = {
    cells,
    config,
    detonatedIndex: null,
    flagsCount: 2,
    phase: 'playing',
    revealedCount: 6,
  };
  const hint = findPlayableHints(game).find(({ index }) => index === 4);
  assert.ok(hint);
  assert.equal(hint.kind, 'safe');
  assert.deepEqual(hint.reason, { clueIndex: 1, kind: 'satisfied-clue', mineCount: 2 });
  assert.deepEqual(hint.references, {
    clueIndices: [1],
    provenMineIndices: [0, 2],
    provenSafeIndices: [3, 5],
    undecidedIndices: [4],
  });
  const steps = hintProofSteps(hint);
  assert.equal(steps.at(-1)?.index, hint.index);
  assert.equal(new Set(steps.map((step) => step.index)).size, steps.length);

  const wrongFlag = structuredClone(game);
  wrongFlag.cells[0].flagged = false;
  wrongFlag.cells[2].flagged = false;
  wrongFlag.cells[4].flagged = true;
  wrongFlag.flagsCount = 1;
  const wrongFlagHint = findPlayableHints(wrongFlag).find(({ index }) => index === 4);
  assert.ok(wrongFlagHint);
  assert.equal(wrongFlagHint.kind, 'safe');
  assert.notEqual(wrongFlagHint.reason.kind, 'satisfied-clue');
});

void test('the D8 flag explanation proves the D7 mine before ruling out a second mine next to E7', () => {
  const config: GameConfig = { columns: 16, mines: 4, noGuessingRequired: false, rows: 16 };
  const cells = cellsWithMines(16, 16, [98, 99, 118, 119]);
  for (const index of [67, 68, 69, 83, 84, 85, 100, 101]) {
    cells[index].revealed = true;
  }
  cells[115].flagged = true;
  const game: Game = {
    cells,
    config,
    detonatedIndex: null,
    flagsCount: 1,
    phase: 'playing',
    revealedCount: 8,
  };
  const hint = checkFlags(game)?.wrongFlags[0]?.hint;
  assert.ok(hint);
  const steps = hintProofSteps(hint);
  assert.deepEqual(
    steps.map(({ index, kind }) => ({ index, kind })),
    [
      { index: 99, kind: 'mine' },
      { index: 115, kind: 'safe' },
    ],
  );
  assert.equal(steps[0].reason.kind, 'clue');
  assert.equal(steps[0].reason.clueIndex, 84);
  assert.deepEqual(steps[0].references.undecidedIndices, [99]);
  assert.equal(steps[1].reason.kind, 'clue');
  assert.equal(steps[1].reason.clueIndex, 100);
  assert.deepEqual(steps[1].references.provenMineIndices, [99]);
  assert.equal(cells[100].adjacent, 1);
});

void test('a constraint hint identifies two clue groups that exhaust a third clue', () => {
  const config: GameConfig = { columns: 8, mines: 10, noGuessingRequired: true, rows: 8 };
  const game = revealCell(createGame(config), 36, randomFromSeed(10));
  const hint = findPlayableHints(game).find(({ index }) => index === 5);
  assert.ok(hint);
  assert.equal(hint.kind, 'safe');
  assert.equal(hint.reason.kind, 'constraints');
  assert.equal(hint.reason.proof.kind, 'covered-clue');
  const { anchor, groups, remaining } = hint.reason.proof;
  assert.equal(anchor.clueIndex, 14);
  assert.equal(anchor.mines, 2);
  assert.deepEqual(
    groups.map(({ constraint }) => constraint.clueIndex),
    [22, 15],
  );
  assert.deepEqual(
    groups.map(({ shared }) => shared),
    [
      [13, 21],
      [6, 7],
    ],
  );
  assert.equal(
    groups.reduce((total, { bound }) => total + bound, 0),
    anchor.mines,
  );
  assert.deepEqual(remaining, [hint.index]);
  assert.deepEqual(hint.references.clueIndices, [14, 22, 15]);
});

void test('following hints can finish a generated no-guess game', () => {
  for (const [size, difficulty, seeds] of [
    [8, 'easy', 6],
    [12, 'medium', 2],
    [16, 'hard', 2],
  ] as const) {
    const config: GameConfig = {
      columns: size,
      mines: minesForDifficulty(difficulty, size, size),
      noGuessingRequired: true,
      rows: size,
    };
    for (let seed = 1; seed <= seeds; seed += 1) {
      let game = revealCell(
        createGame(config),
        Math.floor((size * size) / 2),
        randomFromSeed(seed),
      );
      for (let steps = 0; steps < size * size && game.phase === 'playing'; steps += 1) {
        const hints = findPlayableHints(game);
        assert.ok(
          hints.length > 0,
          `No hint after ${steps} moves on ${size}×${size}, seed ${seed}.`,
        );
        const next = hints[0];
        game = next.kind === 'mine' ? toggleFlag(game, next.index) : revealCell(game, next.index);
      }
      assert.equal(game.phase, 'won', `${size}×${size}, seed ${seed} did not finish.`);
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
