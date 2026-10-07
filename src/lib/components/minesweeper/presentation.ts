import type { GameConfig } from '#lib/minesweeper/game.js';

const COLUMN_LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
export type HintRole =
  | 'wrong-flag'
  | 'target-mine'
  | 'target-safe'
  | 'clue'
  | 'proven-mine'
  | 'proven-safe'
  | 'undecided';
export const HINT_ROLE_LABELS: Record<HintRole, string> = {
  clue: 'Clue used',
  'proven-mine': 'Proven mine',
  'proven-safe': 'Proven safe square',
  'target-mine': 'Mine to flag',
  'target-safe': 'Safe square to reveal',
  undecided: 'Other undecided square',
  'wrong-flag': 'Incorrect flag',
};
export const HINT_ROLE_ORDER: readonly HintRole[] = [
  'wrong-flag',
  'target-mine',
  'target-safe',
  'clue',
  'proven-mine',
  'proven-safe',
  'undecided',
];

export const columnLabel = (index: number): string => {
  let position = index + 1;
  let label = '';
  while (position > 0) {
    position -= 1;
    label = COLUMN_LETTERS[position % COLUMN_LETTERS.length] + label;
    position = Math.floor(position / COLUMN_LETTERS.length);
  }
  return label;
};

export const positionLabel = (index: number, config: GameConfig): string =>
  `row ${Math.floor(index / config.columns) + 1}, column ${columnLabel(index % config.columns)}`;

export const coordinateLabel = (index: number, config: GameConfig): string =>
  `${columnLabel(index % config.columns)}${Math.floor(index / config.columns) + 1}`;

export const coordinateList = (indices: readonly number[], config: GameConfig): string => {
  const coordinates = indices.map((index) => coordinateLabel(index, config));
  if (coordinates.length < 3) {
    return coordinates.join(' and ');
  }
  return `${coordinates.slice(0, -1).join(', ')}, and ${coordinates.at(-1)}`;
};

export const countLabel = (count: number, noun: string): string =>
  `${count} ${noun}${count === 1 ? '' : 's'}`;
