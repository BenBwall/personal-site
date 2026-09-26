import {
  type Constraint,
  type EasyClue,
  type Moves,
  type State,
  clueConstraints,
  constraintComponents,
  enumerateForced,
  unknownCells,
} from '$lib/minesweeper/constraint-solving/core';
import type { Game } from '$lib/minesweeper/game';
import { neighborsOf } from '$lib/minesweeper/neighbors';

type HintReason =
  | {
      kind: 'clue';
      clueIndex: number;
      knownMines: number;
      knownSafe: number;
      remainingMines: number;
      unknownNeighbors: number;
    }
  | { kind: 'satisfied-clue'; clueIndex: number; mineCount: number }
  | { kind: 'constraints'; clueIndices: number[]; proof: ConstraintProof }
  | { kind: 'total'; knownMines: number; remainingMines: number; unknownCells: number };

type HintReferences = {
  clueIndices: number[];
  provenMineIndices: number[];
  provenSafeIndices: number[];
  undecidedIndices: number[];
};

export type PlayableHint = {
  index: number;
  kind: 'safe' | 'mine';
  prerequisites: PlayableHint[];
  proofHint?: PlayableHint;
  reason: HintReason;
  references: HintReferences;
};
type HintDeduction = Omit<PlayableHint, 'prerequisites' | 'proofHint'>;

export type HintConstraint = Constraint;
type CoverageGroup = {
  bound: number;
  constraint: Constraint;
  outside: number[];
  shared: number[];
};
type ConstraintProof =
  | { kind: 'covered-clue'; anchor: Constraint; groups: CoverageGroup[]; remaining: number[] }
  | { kind: 'clue-set'; clues: Constraint[] };
const MAX_PROOF_SEARCH_NODES = 5_000;
const MAX_PROOF_CANDIDATES = 10;

/** Turn a clue's immediate deductions into hints with reasons and referenced cells. */
const hintsForEasyClue = (clue: EasyClue): HintDeduction[] =>
  clue.hidden.map((index) => ({
    index,
    kind: clue.kind,
    reason: {
      clueIndex: clue.clueIndex,
      kind: 'clue',
      knownMines: clue.provenMineIndices.length,
      knownSafe: clue.provenSafeIndices.length,
      remainingMines: clue.remainingMines,
      unknownNeighbors: clue.hidden.length,
    },
    references: {
      clueIndices: [clue.clueIndex],
      provenMineIndices: clue.provenMineIndices,
      provenSafeIndices: clue.provenSafeIndices,
      undecidedIndices: clue.hidden,
    },
  }));

/** Seek a proof using mine bounds from disjoint groups overlapping a clue around the target. */
const coveredClueProof = (
  constraints: readonly Constraint[],
  target: number,
  kind: PlayableHint['kind'],
): ConstraintProof | null => {
  for (const anchor of constraints) {
    if (!anchor.cells.includes(target)) {
      continue;
    }
    const anchorCells = new Set(anchor.cells);
    const candidates = constraints
      .filter((constraint) => constraint !== anchor && !constraint.cells.includes(target))
      .map((constraint): CoverageGroup => {
        const shared = constraint.cells.filter((cell) => anchorCells.has(cell));
        const outside = constraint.cells.filter((cell) => !anchorCells.has(cell));
        return {
          bound:
            kind === 'safe'
              ? Math.max(0, constraint.mines - outside.length)
              : Math.min(constraint.mines, shared.length),
          constraint,
          outside,
          shared,
        };
      })
      .filter(({ bound, shared }) => bound > 0 && shared.length > 0);
    for (let groupCount = 1; groupCount <= 3; groupCount += 1) {
      /** Try nonoverlapping groups whose mine bounds force the target's value. */
      const search = (
        start: number,
        groups: CoverageGroup[],
        covered: Set<number>,
        groupMines: number,
      ): ConstraintProof | null => {
        if (groups.length === groupCount) {
          const remaining = anchor.cells.filter((cell) => !covered.has(cell));
          const forced =
            kind === 'safe'
              ? groupMines === anchor.mines
              : anchor.mines - groupMines === remaining.length;
          return forced && remaining.includes(target)
            ? { anchor, groups, kind: 'covered-clue', remaining }
            : null;
        }
        for (let position = start; position < candidates.length; position += 1) {
          const candidate = candidates[position];
          if (
            groupMines + candidate.bound > anchor.mines ||
            candidate.shared.some((cell) => covered.has(cell))
          ) {
            continue;
          }
          const nextCovered = new Set([...covered, ...candidate.shared]);
          const proof = search(
            position + 1,
            [...groups, candidate],
            nextCovered,
            groupMines + candidate.bound,
          );
          if (proof) {
            return proof;
          }
        }
        return null;
      };
      const proof = search(0, [], new Set<number>(), 0);
      if (proof) {
        return proof;
      }
    }
  }
  return null;
};

/** Find a proof from two or three nearby clues, caching their forced moves. */
const smallClueProof = (
  constraints: readonly Constraint[],
  target: number,
  kind: PlayableHint['kind'],
  cache: Map<string, Moves | null>,
): Constraint[] | null => {
  const directCells = new Set(
    constraints.filter(({ cells }) => cells.includes(target)).flatMap(({ cells }) => cells),
  );
  const candidates = constraints
    .filter(({ cells }) => cells.some((cell) => directCells.has(cell)))
    .toSorted(
      (left, right) =>
        Number(right.cells.includes(target)) - Number(left.cells.includes(target)) ||
        right.cells.filter((cell) => directCells.has(cell)).length -
          left.cells.filter((cell) => directCells.has(cell)).length,
    )
    .slice(0, MAX_PROOF_CANDIDATES);
  for (let size = 2; size <= 3; size += 1) {
    /** Try clue combinations of the chosen size until one forces the target's value. */
    const search = (start: number, selected: Constraint[]): Constraint[] | null => {
      if (selected.length === size) {
        if (!selected.some(({ cells }) => cells.includes(target))) {
          return null;
        }
        const key = selected
          .map(({ clueIndex }) => clueIndex)
          .toSorted((left, right) => left - right)
          .join(',');
        if (!cache.has(key)) {
          const variables = [...new Set(selected.flatMap(({ cells }) => cells))];
          cache.set(key, enumerateForced(selected, variables, MAX_PROOF_SEARCH_NODES));
        }
        const moves = cache.get(key);
        return moves?.[kind === 'safe' ? 'safe' : 'mines'].includes(target) ? selected : null;
      }
      for (let position = start; position < candidates.length; position += 1) {
        const proof = search(position + 1, [...selected, candidates[position]]);
        if (proof) {
          return proof;
        }
      }
      return null;
    };
    const proof = search(0, []);
    if (proof) {
      return proof;
    }
  }
  return null;
};

/** Prefer a compact proof for a forced move, falling back to the full constraint group. */
const constraintProof = (
  constraints: readonly Constraint[],
  target: number,
  kind: PlayableHint['kind'],
  cache: Map<string, Moves | null>,
): ConstraintProof =>
  coveredClueProof(constraints, target, kind) ?? {
    clues: smallClueProof(constraints, target, kind, cache) ?? [...constraints],
    kind: 'clue-set',
  };

/** List the clues used by either form of constraint proof. */
const proofClues = (proof: ConstraintProof): Constraint[] =>
  proof.kind === 'covered-clue'
    ? [proof.anchor, ...proof.groups.map(({ constraint }) => constraint)]
    : proof.clues;

/** Collect the clues and known or undecided cells referenced by a proof. */
const proofReferences = (state: State, proof: ConstraintProof): HintReferences => {
  const clues = proofClues(proof);
  const neighbors = new Set(clues.flatMap(({ clueIndex }) => state.neighbors[clueIndex]));
  return {
    clueIndices: clues.map(({ clueIndex }) => clueIndex),
    provenMineIndices: [...neighbors].filter((index) => state.knownMines[index]),
    provenSafeIndices: [...neighbors].filter((index) => state.knownSafe[index]),
    undecidedIndices: [...new Set(clues.flatMap(({ cells }) => cells))],
  };
};

/** Explain a safe hint using the largest neighboring clue whose proven mines are all flagged. */
const satisfiedFlaggedClue = (
  state: State,
  hint: PlayableHint,
): Pick<PlayableHint, 'reason' | 'references'> | null => {
  if (hint.kind !== 'safe') {
    return null;
  }
  let best: { clueIndex: number; mineCount: number } | null = null;
  for (const clueIndex of state.neighbors[hint.index]) {
    if (!state.revealed[clueIndex]) {
      continue;
    }
    const mineCount = state.cells[clueIndex].adjacent;
    if (mineCount === 0 || (best && mineCount <= best.mineCount)) {
      continue;
    }
    const provenMines = state.neighbors[clueIndex].filter((index) => state.knownMines[index]);
    if (
      provenMines.length === mineCount &&
      provenMines.every((index) => state.cells[index].flagged)
    ) {
      best = { clueIndex, mineCount };
    }
  }
  if (!best) {
    return null;
  }
  const neighbors = state.neighbors[best.clueIndex];
  return {
    reason: { ...best, kind: 'satisfied-clue' },
    references: {
      clueIndices: [best.clueIndex],
      provenMineIndices: neighbors.filter((index) => state.knownMines[index]),
      provenSafeIndices: neighbors.filter((index) => state.revealed[index]),
      undecidedIndices: neighbors.filter(
        (index) => !state.revealed[index] && !state.knownMines[index],
      ),
    },
  };
};

/** List the deductions needed for a hint in proof order, without repeating shared steps. */
export const hintProofSteps = (hint: PlayableHint): PlayableHint[] => {
  const steps: PlayableHint[] = [];
  const seen = new Set<number>();
  const pending = [{ expanded: false, hint: hint.proofHint ?? hint }];
  while (pending.length > 0) {
    const current = pending.pop();
    if (!current || seen.has(current.hint.index)) {
      continue;
    }
    if (current.expanded) {
      seen.add(current.hint.index);
      steps.push(current.hint);
    } else {
      pending.push({ ...current, expanded: true });
      for (const prerequisite of current.hint.prerequisites.toReversed()) {
        pending.push({ expanded: false, hint: prerequisite });
      }
    }
  }
  return steps;
};

/** Initialize deduction state from revealed cells, without treating flags as evidence. */
const createHintState = (game: Game): State => ({
  cells: game.cells,
  knownMines: new Uint8Array(game.cells.length),
  knownSafe: new Uint8Array(game.cells.length),
  neighbors: Array.from({ length: game.cells.length }, (_, index) =>
    neighborsOf(index, game.config),
  ),
  revealed: Uint8Array.from(game.cells, (cell) => Number(cell.revealed)),
  revealedCount: game.revealedCount,
});

/** Collect the proven cells needed to deduce a move from the board's remaining mine count. */
const totalHintReferences = (
  state: State,
  unknown: number[],
  remainingMines: number,
): HintReferences => ({
  clueIndices: [],
  provenMineIndices: state.cells
    .map((_, index) => index)
    .filter((index) => state.knownMines[index]),
  provenSafeIndices:
    remainingMines === unknown.length
      ? state.cells.map((_, index) => index).filter((index) => state.knownSafe[index])
      : [],
  undecidedIndices: unknown,
});

/** Prefer a satisfied flagged clue for the short explanation while retaining the original proof. */
const withSatisfiedFlaggedClue = (
  state: State,
  hints: ReadonlyMap<number, PlayableHint>,
  hint: PlayableHint,
): PlayableHint => {
  const satisfied = satisfiedFlaggedClue(state, hint);
  if (!satisfied) {
    return hint;
  }
  const prerequisites = satisfied.references.provenMineIndices.flatMap((index) => {
    const prerequisite = hints.get(index);
    return prerequisite ? [prerequisite] : [];
  });
  // Use the simpler clue only when its mine proofs do not depend on this safe square.
  const independent = prerequisites.every((prerequisite) =>
    hintProofSteps(prerequisite).every((step) => step.index !== hint.index),
  );
  return {
    ...hint,
    ...satisfied,
    proofHint: independent ? { ...hint, ...satisfied, prerequisites } : hint,
  };
};

/** Suggest deductions from the visible position; player flags are not assumed to be correct. */
export const findPlayableHints = (game: Game): PlayableHint[] => {
  if (game.phase !== 'playing') {
    return [];
  }
  const state = createHintState(game);
  const hints = new Map<number, PlayableHint>();
  /** Store a new hint for a hidden cell and record its proven value. */
  const add = (hint: HintDeduction): boolean => {
    if (state.revealed[hint.index] || hints.has(hint.index)) {
      return false;
    }
    const prerequisites = [
      ...hint.references.provenMineIndices,
      // A satisfied clue rules out other mines without needing to prove its safe neighbors first.
      ...(hint.kind === 'safe' && hint.reason.kind === 'clue'
        ? []
        : hint.references.provenSafeIndices),
    ].flatMap((index) => {
      const prerequisite = hints.get(index);
      return prerequisite ? [prerequisite] : [];
    });
    hints.set(hint.index, { ...hint, prerequisites });
    (hint.kind === 'mine' ? state.knownMines : state.knownSafe)[hint.index] = 1;
    return true;
  };
  /** Add forced moves as hints sharing a reason and references, reporting whether any are new. */
  const addMoves = (moves: Moves, reason: HintReason, references: HintReferences): boolean => {
    let added = false;
    for (const index of moves.safe) {
      added = add({ index, kind: 'safe', reason, references }) || added;
    }
    for (const index of moves.mines) {
      added = add({ index, kind: 'mine', reason, references }) || added;
    }
    return added;
  };

  let progress = true;
  for (let passes = 0; progress && passes < game.cells.length; passes += 1) {
    progress = false;
    const clues = clueConstraints(state);
    if (!clues) {
      return [];
    }
    // These constraints account only for deductions known at the start of this pass.
    const proofState = {
      ...state,
      knownMines: state.knownMines.slice(),
      knownSafe: state.knownSafe.slice(),
    };
    for (const clue of clues.easyClues) {
      for (const hint of hintsForEasyClue(clue)) {
        progress = add(hint) || progress;
      }
    }
    for (const component of constraintComponents(clues.constraints)) {
      const moves = enumerateForced(component.constraints, component.variables);
      if (moves) {
        const cache = new Map<string, Moves | null>();
        const proposed = [
          ...moves.safe.map((index) => ({ index, kind: 'safe' as const })),
          ...moves.mines.map((index) => ({ index, kind: 'mine' as const })),
        ].map(({ index, kind }) => {
          const proof = constraintProof(component.constraints, index, kind, cache);
          const references = proofReferences(proofState, proof);
          return {
            index,
            kind,
            reason: { clueIndices: references.clueIndices, kind: 'constraints' as const, proof },
            references,
          };
        });
        for (const hint of proposed) {
          progress = add(hint) || progress;
        }
      }
    }
    const knownMines = state.knownMines.reduce((total, mine) => total + mine, 0);
    const remainingMines = game.config.mines - knownMines;
    const unknown = unknownCells(state);
    if (remainingMines < 0 || remainingMines > unknown.length) {
      return [];
    }
    const reason: HintReason = {
      kind: 'total',
      knownMines,
      remainingMines,
      unknownCells: unknown.length,
    };
    const references = totalHintReferences(state, unknown, remainingMines);
    if (remainingMines === 0) {
      progress = addMoves({ mines: [], safe: unknown }, reason, references) || progress;
    } else if (remainingMines === unknown.length) {
      progress = addMoves({ mines: unknown, safe: [] }, reason, references) || progress;
    }
  }
  return [...hints.values()]
    .filter(({ index, kind }) => kind === 'safe' || !game.cells[index].flagged)
    .map((hint) => withSatisfiedFlaggedClue(state, hints, hint));
};
