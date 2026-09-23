import {
  type Cell,
  type Difficulty,
  type Game,
  type GameConfig,
  isValidConfig,
} from '$lib/minesweeper/game';

export const GAME_STORAGE_KEY = 'personal-site:minesweeper';
export const GAME_STATE_MAX_AGE_MS = 48 * 60 * 60 * 1000;
const SNAPSHOT_VERSION = 1;

export type SavedGameState = {
  difficulty: Difficulty | null;
  elapsedSeconds: number;
  game: Game;
  menuOpen: boolean;
  scrollLeft: number;
  scrollTop: number;
  setup: GameConfig;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const readConfig = (value: unknown): GameConfig | null => {
  if (
    !isRecord(value) ||
    typeof value.columns !== 'number' ||
    typeof value.mines !== 'number' ||
    typeof value.rows !== 'number'
  ) {
    return null;
  }
  const config = { columns: value.columns, mines: value.mines, rows: value.rows };
  return isValidConfig(config) ? config : null;
};

const isCell = (value: unknown): value is Cell =>
  isRecord(value) &&
  Number.isInteger(value.adjacent) &&
  typeof value.adjacent === 'number' &&
  value.adjacent >= 0 &&
  value.adjacent <= 8 &&
  typeof value.flagged === 'boolean' &&
  typeof value.mine === 'boolean' &&
  typeof value.revealed === 'boolean' &&
  !(value.flagged && value.revealed);

const readGame = (value: unknown): Game | null => {
  if (!isRecord(value)) {
    return null;
  }
  const config = readConfig(value.config);
  const phase = value.phase;
  if (
    !config ||
    !Array.isArray(value.cells) ||
    value.cells.length !== config.rows * config.columns ||
    !value.cells.every(isCell) ||
    !Number.isSafeInteger(value.flagsCount) ||
    typeof value.flagsCount !== 'number' ||
    !Number.isSafeInteger(value.revealedCount) ||
    typeof value.revealedCount !== 'number' ||
    (phase !== 'ready' && phase !== 'playing' && phase !== 'won' && phase !== 'lost')
  ) {
    return null;
  }

  const cells: Cell[] = value.cells;
  const flagsCount = cells.filter((cell) => cell.flagged).length;
  const revealedCount = cells.filter((cell) => cell.revealed && !cell.mine).length;
  const mineCount = cells.filter((cell) => cell.mine).length;
  if (
    value.flagsCount !== flagsCount ||
    value.revealedCount !== revealedCount ||
    flagsCount > config.mines ||
    (phase === 'ready' &&
      (mineCount !== 0 || revealedCount !== 0 || cells.some((cell) => cell.adjacent !== 0))) ||
    (phase !== 'ready' && mineCount !== config.mines)
  ) {
    return null;
  }

  let detonatedIndex: number | null;
  if (phase === 'lost') {
    const index = value.detonatedIndex;
    if (
      typeof index !== 'number' ||
      !Number.isSafeInteger(index) ||
      index < 0 ||
      index >= cells.length ||
      !cells[index].mine ||
      !cells[index].revealed
    ) {
      return null;
    }
    detonatedIndex = index;
  } else {
    if (value.detonatedIndex !== null) {
      return null;
    }
    detonatedIndex = null;
  }
  if (
    phase === 'won' &&
    (revealedCount !== cells.length - config.mines ||
      flagsCount !== config.mines ||
      cells.some((cell) => cell.mine && !cell.flagged))
  ) {
    return null;
  }

  return {
    cells,
    config,
    detonatedIndex,
    flagsCount,
    phase,
    revealedCount,
  };
};

export const serializeGameState = (state: SavedGameState, savedAt = Date.now()): string =>
  JSON.stringify({ ...state, savedAt, version: SNAPSHOT_VERSION });

export const readSavedGameState = (raw: string | null, now = Date.now()): SavedGameState | null => {
  if (raw === null) {
    return null;
  }
  try {
    const value: unknown = JSON.parse(raw);
    if (
      !isRecord(value) ||
      value.version !== SNAPSHOT_VERSION ||
      !Number.isSafeInteger(value.savedAt) ||
      typeof value.savedAt !== 'number' ||
      value.savedAt < 0 ||
      now - value.savedAt > GAME_STATE_MAX_AGE_MS ||
      typeof value.menuOpen !== 'boolean' ||
      !Number.isSafeInteger(value.elapsedSeconds) ||
      typeof value.elapsedSeconds !== 'number' ||
      value.elapsedSeconds < 0 ||
      (value.difficulty !== null &&
        value.difficulty !== 'easy' &&
        value.difficulty !== 'medium' &&
        value.difficulty !== 'hard')
    ) {
      return null;
    }
    const game = readGame(value.game);
    const setup = readConfig(value.setup);
    const scrollLeft = value.scrollLeft === undefined ? 0 : value.scrollLeft;
    const scrollTop = value.scrollTop === undefined ? 0 : value.scrollTop;
    if (
      !game ||
      !setup ||
      typeof scrollLeft !== 'number' ||
      !Number.isFinite(scrollLeft) ||
      scrollLeft < 0 ||
      typeof scrollTop !== 'number' ||
      !Number.isFinite(scrollTop) ||
      scrollTop < 0
    ) {
      return null;
    }
    return {
      difficulty: value.difficulty,
      elapsedSeconds: value.elapsedSeconds,
      game,
      menuOpen: value.menuOpen,
      scrollLeft,
      scrollTop,
      setup,
    };
  } catch {
    return null;
  }
};
