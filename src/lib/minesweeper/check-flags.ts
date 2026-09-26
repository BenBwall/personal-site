import {
  type PlayableHint,
  findPlayableHints,
} from '$lib/minesweeper/constraint-solving/generate-hints';
import type { Game } from '$lib/minesweeper/game';

export type FlagCheck = {
  flagsCount: number;
  wrongFlags: { index: number; hint: PlayableHint | null }[];
};

/** Check placed flags against the board and attach available deductions proving them wrong. */
export const checkFlags = (game: Game): FlagCheck | null => {
  if (game.phase === 'ready') {
    return null;
  }
  const flags = game.cells.flatMap((cell, index) => (cell.flagged ? [index] : []));
  const wrong = flags.filter((index) => !game.cells[index].mine);
  const safeHints = new Map(
    (wrong.length > 0 ? findPlayableHints(game) : [])
      .filter((hint) => hint.kind === 'safe')
      .map((hint) => [hint.index, hint]),
  );
  return {
    flagsCount: flags.length,
    wrongFlags: wrong.map((index) => ({ hint: safeHints.get(index) ?? null, index })),
  };
};
