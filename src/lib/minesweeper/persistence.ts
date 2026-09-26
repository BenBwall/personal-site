import { gameConfigSchema } from '$lib/minesweeper/game';
import { z } from '$lib/validation';

export const GAME_STORAGE_KEY = 'personal-site:minesweeper';
const GAME_STATE_MAX_AGE_MS = 48 * 60 * 60 * 1000;
const SNAPSHOT_VERSION = 1;

// Snapshots saved before this option existed used ordinary random boards.
const storedConfigSchema = z
  .object({
    ...gameConfigSchema.shape,
    noGuessingRequired: z
      .boolean()
      .nullish()
      .transform((value) => value ?? false),
  })
  .pipe(gameConfigSchema);

const cellSchema = z
  .looseObject({
    adjacent: z.int().min(0).max(8),
    flagged: z.boolean(),
    mine: z.boolean(),
    revealed: z.boolean(),
  })
  .refine(({ flagged, revealed }) => !(flagged && revealed), {
    message: 'A revealed cell cannot be flagged.',
  });

const storedGameSchema = z
  .object({
    cells: z.array(cellSchema),
    config: storedConfigSchema,
    detonatedIndex: z.int().nonnegative().nullable(),
    flagsCount: z.int().nonnegative(),
    phase: z.enum(['ready', 'playing', 'won', 'lost']),
    revealedCount: z.int().nonnegative(),
  })
  .refine(({ cells, config }) => cells.length === config.rows * config.columns, {
    message: 'The cell count must match the board dimensions.',
    path: ['cells'],
  })
  .refine(
    ({ cells, config, flagsCount, revealedCount }) =>
      flagsCount === cells.filter((cell) => cell.flagged).length &&
      revealedCount === cells.filter((cell) => cell.revealed && !cell.mine).length &&
      flagsCount <= config.mines,
    { message: 'Stored counts must match the cells.' },
  )
  .refine(
    ({ cells, config, phase, revealedCount }) =>
      phase === 'ready'
        ? revealedCount === 0 && cells.every((cell) => !cell.mine && cell.adjacent === 0)
        : cells.filter((cell) => cell.mine).length === config.mines,
    { message: 'Mine placement must match the game phase.' },
  )
  .refine(
    ({ cells, detonatedIndex, phase }) =>
      phase === 'lost'
        ? detonatedIndex !== null &&
          detonatedIndex < cells.length &&
          cells[detonatedIndex]?.mine &&
          cells[detonatedIndex].revealed
        : detonatedIndex === null,
    {
      message: 'Only a lost game can contain a revealed detonated mine.',
      path: ['detonatedIndex'],
    },
  )
  .refine(
    ({ cells, config, flagsCount, phase, revealedCount }) =>
      phase !== 'won' ||
      (revealedCount === cells.length - config.mines &&
        flagsCount === config.mines &&
        cells.every((cell) => !cell.mine || cell.flagged)),
    { message: 'A won game must reveal all safe cells and flag every mine.' },
  );

const savedGameStateSchema = z.object({
  difficulty: z.enum(['easy', 'medium', 'hard']).nullable(),
  elapsedSeconds: z.int().nonnegative(),
  game: storedGameSchema,
  menuOpen: z.boolean(),
  scrollLeft: z.number().nonnegative().default(0),
  scrollTop: z.number().nonnegative().default(0),
  setup: storedConfigSchema,
});

export type SavedGameState = z.infer<typeof savedGameStateSchema>;

const snapshotSchema = savedGameStateSchema.extend({
  savedAt: z.int().nonnegative(),
  version: z.literal(SNAPSHOT_VERSION),
});

export const serializeGameState = (state: SavedGameState, savedAt = Date.now()): string =>
  JSON.stringify({ ...state, savedAt, version: SNAPSHOT_VERSION });

/** Restore a consistent, unexpired snapshot, applying defaults for older saved games. */
export const readSavedGameState = (raw: string | null, now = Date.now()): SavedGameState | null => {
  if (raw === null) {
    return null;
  }
  try {
    const value: unknown = JSON.parse(raw);
    const result = snapshotSchema
      .refine(({ savedAt }) => now - savedAt <= GAME_STATE_MAX_AGE_MS, {
        message: 'The saved game has expired.',
        path: ['savedAt'],
      })
      .safeParse(value);
    if (!result.success) {
      return null;
    }
    const { difficulty, elapsedSeconds, game, menuOpen, scrollLeft, scrollTop, setup } =
      result.data;
    return { difficulty, elapsedSeconds, game, menuOpen, scrollLeft, scrollTop, setup };
  } catch {
    return null;
  }
};
