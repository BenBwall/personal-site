import { validateIsSolveable } from "./validate-solveable";

export type GameConfig = {
  columns: number;
  mines: number;
  rows: number;
  isDefinitelySolveable: boolean;
};

export const MIN_BOARD_SIZE = 5;

export const maxMineCount = (rows: number, columns: number): number => rows * columns - 9;

export const BOARD_SIZES = {
  large: { columns: 16, rows: 16 },
  medium: { columns: 12, rows: 12 },
  small: { columns: 8, rows: 8 },
} as const;

export const MINE_DENSITIES = {
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

export const defaultConfig: () => GameConfig = () => ({
  ...BOARD_SIZES.small,
  mines: minesForDifficulty('easy', BOARD_SIZES.small.rows, BOARD_SIZES.small.columns),
  isDefinitelySolveable: true,
});

export const isValidConfig = ({ columns, mines, rows }: GameConfig): boolean =>
  Number.isSafeInteger(rows) &&
  rows >= MIN_BOARD_SIZE &&
  Number.isSafeInteger(columns) &&
  columns >= MIN_BOARD_SIZE &&
  Number.isSafeInteger(rows * columns) &&
  Number.isSafeInteger(mines) &&
  mines >= 1 &&
  mines <= maxMineCount(rows, columns);

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
  if (!isValidConfig(config)) {
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

const neighborsOf = (index: number, { columns, rows }: GameConfig): number[] => {
  const row = Math.floor(index / columns);
  const column = index % columns;
  const neighbors: number[] = [];

  for (let rowOffset = -1; rowOffset <= 1; rowOffset += 1) {
    for (let columnOffset = -1; columnOffset <= 1; columnOffset += 1) {
      if (rowOffset === 0 && columnOffset === 0) {
        continue;
      }

      const nextRow = row + rowOffset;
      const nextColumn = column + columnOffset;
      if (nextRow >= 0 && nextRow < rows && nextColumn >= 0 && nextColumn < columns) {
        neighbors.push(nextRow * columns + nextColumn);
      }
    }
  }

  return neighbors;
};

const placeMines = (
  cells: Cell[],
  safeIndex: number,
  config: GameConfig,
  random: () => number,
): Cell[] => {
  cells = placeMinesOnce(cells, safeIndex, config, random);
  if (!config.isDefinitelySolveable) {
    return cells;
  }

  while (!validateIsSolveable(cells)) {
    cells = placeMinesOnce(cells, safeIndex, config, random);
  }

  return cells;
};

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

  const mineIndices = new Set(candidates.slice(0, config.mines));
  return cells.map((cell, index) => ({
    ...cell,
    adjacent: neighborsOf(index, config).filter((neighbor) => mineIndices.has(neighbor)).length,
    mine: mineIndices.has(index),
  }));
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
