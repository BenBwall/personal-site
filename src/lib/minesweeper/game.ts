import { placeMines } from '$lib/minesweeper/constraint-solving/find-solvable-games';
import { neighborsOf } from '$lib/minesweeper/neighbors';
import { z } from '$lib/validation';

export const MIN_BOARD_SIZE = 5;

export const maxMineCount = (rows: number, columns: number): number => rows * columns - 9;

/** Validate board dimensions and ensure the total cell count is a safe integer. */
export const boardSizeSchema = z
  .object({
    columns: z.int().min(MIN_BOARD_SIZE),
    rows: z.int().min(MIN_BOARD_SIZE),
  })
  .refine(({ columns, rows }) => rows * columns <= Number.MAX_SAFE_INTEGER, {
    message: 'The board must contain a safe integer number of cells.',
    path: ['rows'],
  });

/** Validate the mine count while reserving a safe opening around the first click. */
export const gameConfigSchema = boardSizeSchema
  .safeExtend({
    mines: z.int().min(1),
    noGuessingRequired: z.boolean(),
  })
  .refine(({ columns, mines, rows }) => mines <= maxMineCount(rows, columns), {
    message: 'Leave enough safe cells for the first click and its neighbors.',
    path: ['mines'],
  });

export type GameConfig = z.infer<typeof gameConfigSchema>;

export const BOARD_SIZES = {
  large: { columns: 16, rows: 16 },
  medium: { columns: 12, rows: 12 },
  small: { columns: 8, rows: 8 },
} as const;

const MINE_DENSITIES = {
  easy: 0.15,
  hard: 0.25,
  medium: 0.2,
} as const;

export type Difficulty = keyof typeof MINE_DENSITIES;

export const minesForDifficulty = (difficulty: Difficulty, rows: number, columns: number): number =>
  Math.min(
    maxMineCount(rows, columns),
    Math.max(1, Math.round(rows * columns * MINE_DENSITIES[difficulty])),
  );

const defaultConfig: () => GameConfig = () => ({
  ...BOARD_SIZES.small,
  mines: minesForDifficulty('easy', BOARD_SIZES.small.rows, BOARD_SIZES.small.columns),
  noGuessingRequired: true,
});

export type Cell = {
  adjacent: number;
  flagged: boolean;
  mine: boolean;
  revealed: boolean;
};

export type Game = {
  cells: Cell[];
  config: GameConfig;
  detonatedIndex: number | null;
  flagsCount: number;
  phase: 'ready' | 'playing' | 'won' | 'lost';
  revealedCount: number;
};

export const createGame = (config: GameConfig = defaultConfig()): Game => {
  if (!gameConfigSchema.safeParse(config).success) {
    throw new RangeError('Invalid Minesweeper board configuration.');
  }

  return {
    cells: Array.from({ length: config.rows * config.columns }, () => ({
      adjacent: 0,
      flagged: false,
      mine: false,
      revealed: false,
    })),
    config: { ...config },
    detonatedIndex: null,
    flagsCount: 0,
    phase: 'ready',
    revealedCount: 0,
  };
};

export const revealCell = (game: Game, index: number, random = Math.random): Game => {
  if (index < 0 || index >= game.cells.length) {
    return game;
  }
  const selected = game.cells[index];
  if (selected.flagged || selected.revealed || game.phase === 'won' || game.phase === 'lost') {
    return game;
  }

  const cells =
    game.phase === 'ready' ? placeMines(game.cells, index, game.config, random) : [...game.cells];
  if (cells[index].mine) {
    cells[index] = { ...cells[index], revealed: true };
    return { ...game, cells, detonatedIndex: index, phase: 'lost' };
  }

  const pending = [index];
  let revealedCount = game.revealedCount;
  while (pending.length > 0) {
    const currentIndex = pending.pop();
    if (currentIndex === undefined) {
      continue;
    }

    const cell = cells[currentIndex];
    if (cell.revealed || cell.flagged || cell.mine) {
      continue;
    }

    cells[currentIndex] = { ...cell, revealed: true };
    revealedCount += 1;
    if (cell.adjacent === 0) {
      pending.push(...neighborsOf(currentIndex, game.config));
    }
  }

  if (revealedCount === game.cells.length - game.config.mines) {
    return {
      ...game,
      cells: cells.map((cell) => (cell.mine ? { ...cell, flagged: true } : cell)),
      flagsCount: game.config.mines,
      phase: 'won',
      revealedCount,
    };
  }

  return { ...game, cells, phase: 'playing', revealedCount };
};

export const revealAdjacentCells = (game: Game, index: number): Game => {
  if (game.phase !== 'playing' || index < 0 || index >= game.cells.length) {
    return game;
  }
  const selected = game.cells[index];
  if (!selected.revealed || selected.mine || selected.adjacent === 0) {
    return game;
  }

  const neighbors = neighborsOf(index, game.config);
  if (neighbors.filter((neighbor) => game.cells[neighbor].flagged).length !== selected.adjacent) {
    return game;
  }

  const hiddenNeighbors = neighbors.filter(
    (neighbor) => !game.cells[neighbor].flagged && !game.cells[neighbor].revealed,
  );
  const unflaggedMine = hiddenNeighbors.find((neighbor) => game.cells[neighbor].mine);
  if (unflaggedMine !== undefined) {
    return revealCell(game, unflaggedMine);
  }
  return hiddenNeighbors.reduce((current, neighbor) => revealCell(current, neighbor), game);
};

export const toggleFlag = (game: Game, index: number): Game => {
  if (index < 0 || index >= game.cells.length) {
    return game;
  }
  const cell = game.cells[index];
  if (cell.revealed || game.phase === 'won' || game.phase === 'lost') {
    return game;
  }
  if (!cell.flagged && game.flagsCount === game.config.mines) {
    return game;
  }

  const cells = [...game.cells];
  cells[index] = { ...cell, flagged: !cell.flagged };
  return { ...game, cells, flagsCount: game.flagsCount + (cell.flagged ? -1 : 1) };
};
