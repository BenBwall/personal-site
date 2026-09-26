import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { createContext, runInContext } from 'node:vm';

import { type Game, createGame, gameConfigSchema } from '$lib/minesweeper/game';
import { neighborsOf } from '$lib/minesweeper/neighbors';
import {
  type SavedGameState,
  readSavedGameState,
  serializeGameState,
} from '$lib/minesweeper/persistence';
import { parseColorScheme, parsePreferences, parseThemeChannels } from '$lib/theme/parsing';
import { themeChannelsSchema } from '$lib/theme/schemas';

import { generateThemeInit } from '#scripts/generate-theme-init.ts';

const savedState = (game = createGame()): SavedGameState => ({
  difficulty: 'easy',
  elapsedSeconds: 0,
  game,
  menuOpen: true,
  scrollLeft: 0,
  scrollTop: 0,
  setup: game.config,
});

void test('config validation preserves integer, board-size, and safe-opening limits', () => {
  const config = { columns: 5, mines: 16, noGuessingRequired: false, rows: 5 };
  assert.equal(gameConfigSchema.safeParse(config).success, true);
  assert.equal(gameConfigSchema.safeParse({ ...config, mines: 1 }).success, true);
  assert.equal(
    gameConfigSchema.safeParse({ ...config, columns: Math.floor(Number.MAX_SAFE_INTEGER / 5) })
      .success,
    true,
  );

  for (const invalid of [
    null,
    [],
    {},
    { ...config, rows: 4 },
    { ...config, columns: 4 },
    { ...config, rows: 5.5 },
    { ...config, columns: '5' },
    { ...config, rows: NaN },
    { ...config, columns: Infinity },
    { ...config, columns: Number.MAX_SAFE_INTEGER },
    { ...config, mines: 0 },
    { ...config, mines: 17 },
    { ...config, mines: 1.5 },
    { ...config, mines: Number.MAX_SAFE_INTEGER + 1 },
    { ...config, noGuessingRequired: undefined },
    { ...config, noGuessingRequired: null },
    { ...config, noGuessingRequired: 'false' },
  ]) {
    assert.equal(gameConfigSchema.safeParse(invalid).success, false, JSON.stringify(invalid));
  }
  assert.throws(() => createGame({ ...config, mines: 17 }), RangeError);
});

void test('snapshots preserve legacy defaults and the 48-hour expiry boundary', () => {
  const state = savedState();
  const snapshot = { ...state, savedAt: 1000, version: 1 };
  const oldConfig = {
    columns: state.game.config.columns,
    mines: state.game.config.mines,
    rows: state.game.config.rows,
  };
  for (const config of [oldConfig, { ...oldConfig, noGuessingRequired: null }]) {
    const old = {
      ...snapshot,
      game: { ...state.game, config },
      scrollLeft: undefined,
      scrollTop: undefined,
      setup: config,
    };
    assert.deepEqual(readSavedGameState(JSON.stringify(old), 1000), {
      ...state,
      game: { ...state.game, config: { ...oldConfig, noGuessingRequired: false } },
      setup: { ...oldConfig, noGuessingRequired: false },
    });
  }

  const raw = JSON.stringify(snapshot);
  const maxAge = 48 * 60 * 60 * 1000;
  assert.deepEqual(readSavedGameState(raw, 1000 + maxAge), state);
  assert.equal(readSavedGameState(raw, 1001 + maxAge), null);
  assert.deepEqual(readSavedGameState(raw, 999), state);
});

void test('snapshots reject malformed headers, cells, counts, and board states', () => {
  const state = savedState();
  const snapshot = { ...state, savedAt: 1000, version: 1 };
  const { game } = state;
  const cellsWith = (cell: unknown) => [cell, ...game.cells.slice(1)];
  for (const invalid of [
    null,
    [],
    { ...snapshot, version: 2 },
    { ...snapshot, savedAt: -1 },
    { ...snapshot, savedAt: 0.5 },
    { ...snapshot, menuOpen: 'true' },
    { ...snapshot, difficulty: 'expert' },
    { ...snapshot, elapsedSeconds: -1 },
    { ...snapshot, elapsedSeconds: 0.5 },
    { ...snapshot, scrollLeft: null },
    { ...snapshot, scrollTop: -1 },
    { ...snapshot, setup: { ...game.config, mines: 0 } },
    { ...snapshot, game: { ...game, cells: game.cells.slice(1) } },
    { ...snapshot, game: { ...game, cells: cellsWith(null) } },
    { ...snapshot, game: { ...game, cells: cellsWith({ ...game.cells[0], adjacent: 9 }) } },
    { ...snapshot, game: { ...game, cells: cellsWith({ ...game.cells[0], flagged: 'false' }) } },
    { ...snapshot, game: { ...game, flagsCount: 1 } },
    { ...snapshot, game: { ...game, revealedCount: 1 } },
    { ...snapshot, game: { ...game, phase: 'unknown' } },
    { ...snapshot, game: { ...game, phase: 'playing' } },
    { ...snapshot, game: { ...game, phase: 'won' } },
    { ...snapshot, game: { ...game, phase: 'lost' } },
    { ...snapshot, game: { ...game, detonatedIndex: 0 } },
  ]) {
    assert.equal(readSavedGameState(JSON.stringify(invalid), 1000), null);
  }
  for (const raw of [null, '', '{broken', '42']) {
    assert.equal(readSavedGameState(raw, 1000), null);
  }
});

void test('snapshots accept playing, won, and lost games and enforce their invariants', () => {
  const config = { columns: 5, mines: 1, noGuessingRequired: false, rows: 5 };
  const cells = createGame(config).cells.map((cell, index) => ({
    ...cell,
    adjacent: neighborsOf(index, config).filter((neighbor) => neighbor === 0).length,
    mine: index === 0,
    revealed: index === 12,
  }));
  const playing: Game = {
    cells,
    config,
    detonatedIndex: null,
    flagsCount: 0,
    phase: 'playing',
    revealedCount: 1,
  };
  const won: Game = {
    ...playing,
    cells: cells.map((cell) => ({ ...cell, flagged: cell.mine, revealed: !cell.mine })),
    flagsCount: 1,
    phase: 'won',
    revealedCount: 24,
  };
  const lost: Game = {
    ...playing,
    cells: cells.map((cell, index) => ({ ...cell, revealed: cell.revealed || index === 0 })),
    detonatedIndex: 0,
    phase: 'lost',
  };
  for (const game of [playing, won, lost]) {
    const state = savedState(game);
    assert.deepEqual(readSavedGameState(serializeGameState(state, 1000), 1000), state);
  }
  for (const game of [
    { ...lost, detonatedIndex: 12 },
    { ...lost, detonatedIndex: -1 },
    { ...lost, detonatedIndex: 25 },
    { ...lost, detonatedIndex: 0.5 },
    { ...lost, cells: playing.cells },
    { ...won, cells: cells.map((cell) => ({ ...cell, revealed: !cell.mine })), flagsCount: 0 },
    { ...won, cells: won.cells.map((cell) => ({ ...cell, flagged: true })) },
  ]) {
    assert.equal(readSavedGameState(serializeGameState(savedState(game), 1000), 1000), null);
  }
});

void test('shared theme parsers preserve preferences and match the regular channel validation', () => {
  assert.equal(parseColorScheme('light'), 'light');
  assert.equal(parseColorScheme('dark'), 'dark');
  assert.deepEqual(parsePreferences({ reducedMotion: false }), { reducedMotion: false });
  assert.deepEqual(parsePreferences({ reducedMotion: true }), { reducedMotion: true });
  for (const invalid of [null, [], {}, 'dark', { reducedMotion: 'false' }]) {
    assert.deepEqual(parsePreferences(invalid), {});
  }
  for (const invalid of [null, undefined, 'sepia', {}, 1]) {
    assert.equal(parseColorScheme(invalid), null);
  }

  for (const channels of [
    { chroma: 0, hue: 0, luminosity: 0 },
    { chroma: 0.5, hue: 360, luminosity: 1 },
    { chroma: 0.14, hue: 250, luminosity: 0.6 },
  ]) {
    assert.deepEqual(parseThemeChannels(channels), channels);
    assert.deepEqual(themeChannelsSchema.parse(channels), channels);
  }
  const base = { chroma: 0.14, hue: 250, luminosity: 0.6 };
  for (const [channel, values] of [
    ['chroma', [-1, 0.51, NaN, Infinity, '0.14', null]],
    ['hue', [-1, 361, 250.5, NaN, Infinity, '250', null]],
    ['luminosity', [-1, 1.01, NaN, Infinity, '0.6', null]],
  ] as const) {
    for (const value of values) {
      const saved = { ...base, [channel]: value };
      const { [channel]: _ignored, ...remaining } = base;
      assert.deepEqual(parseThemeChannels(saved), remaining);
      assert.equal(themeChannelsSchema.safeParse(saved).success, false);
      assert.equal(parseThemeChannels(saved)[channel], undefined);
    }
  }
  for (const invalid of [null, [], {}, 'theme']) {
    assert.deepEqual(parseThemeChannels(invalid), {});
  }
});

void test('the startup script applies preferences without Zod or dynamic code generation', async () => {
  await generateThemeInit();
  const source = await readFile('static/theme-init.js', 'utf8');
  for (const [stored, expected] of [
    [{}, { reducedMotion: 'true' }],
    [
      {
        'appearance-preferences': '{"reducedMotion":false}',
        'color-scheme': 'dark',
        theme: '{"chroma":0.2,"hue":360,"luminosity":0}',
      },
      { chroma: '0.2', hue: '360', luminosity: '0', reducedMotion: 'false', scheme: 'dark' },
    ],
    [
      {
        'appearance-preferences': '{"reducedMotion":"false"}',
        'color-scheme': 'sepia',
        theme: '{"chroma":0.1,"hue":12.5,"luminosity":2}',
      },
      { chroma: '0.1', reducedMotion: 'true' },
    ],
    [{ 'appearance-preferences': '{broken', theme: '{broken' }, { reducedMotion: 'true' }],
  ] as const) {
    const applied: Record<string, string> = {};
    const root = {
      dataset: {} as Record<string, string>,
      style: {
        colorScheme: undefined as string | undefined,
        setProperty: (name: string, value: string) => {
          applied[name.replace('--theme-', '')] = value;
        },
      },
    };
    const storage: Readonly<Record<string, string | undefined>> = stored;
    const context = createContext(
      {
        document: { documentElement: root },
        localStorage: { getItem: (key: string) => storage[key] ?? null },
        matchMedia: () => ({ matches: true }),
      },
      { codeGeneration: { strings: false, wasm: false } },
    );
    assert.throws(() => runInContext('new Function("return 1")()', context), { name: 'EvalError' });
    runInContext(source, context);
    assert.deepEqual(
      {
        ...applied,
        reducedMotion: root.dataset.reducedMotion,
        ...(root.style.colorScheme ? { scheme: root.style.colorScheme } : {}),
      },
      expected,
    );
  }
});
