import {
  type PlayableHint,
  findPlayableHints,
} from '#lib/minesweeper/constraint-solving/generate-hints.js';
import type { Game } from '#lib/minesweeper/game.js';

export type FlagCheckMode = 'board' | 'proof';
export type CheckedFlag = {
  hint: PlayableHint | null;
  index: number;
  status: 'correct' | 'incorrect' | 'unproven';
};
export type FlagCheck = { flags: CheckedFlag[]; mode: FlagCheckMode };

/** Check flags against either the hidden layout or deductions from the visible clues. */
export const checkFlags = (game: Game, mode: FlagCheckMode = 'board'): FlagCheck | null => {
  if (game.phase === 'ready') {
    return null;
  }
  const flags = game.cells.flatMap((cell, index) => (cell.flagged ? [index] : []));
  const needsProof = mode === 'proof' || flags.some((index) => !game.cells[index].mine);
  const proofs = new Map(
    (needsProof ? findPlayableHints(game, { includeFlaggedMines: true }) : []).map((hint) => [
      hint.index,
      hint,
    ]),
  );
  return {
    flags: flags.map((index): CheckedFlag => {
      const hint = proofs.get(index) ?? null;
      if (mode === 'proof') {
        return {
          hint,
          index,
          status: hint === null ? 'unproven' : hint.kind === 'mine' ? 'correct' : 'incorrect',
        };
      }
      return {
        hint: hint?.kind === 'safe' ? hint : null,
        index,
        status: game.cells[index].mine ? 'correct' : 'incorrect',
      };
    }),
    mode,
  };
};
