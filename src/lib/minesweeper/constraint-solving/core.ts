/**
 * Solvability checks and hints based on Benedikt Simon Kunz's 2024 bachelor's thesis,
 * "Approaches to creating solvable Minesweeper instances and providing assistance
 * during game playing using constraint programming" (sections 3.3 and 3.5).
 * https://doc.neuro.tu-berlin.de/bachelor/2024-BA-BenediktKunz.pdf
 */
import type { Cell, GameConfig } from '$lib/minesweeper/game';

export type Constraint = { cells: number[]; clueIndex: number; mines: number };
export type Moves = { mines: number[]; safe: number[] };
export type EasyClue = {
  clueIndex: number;
  hidden: number[];
  kind: 'safe' | 'mine';
  provenMineIndices: number[];
  provenSafeIndices: number[];
  remainingMines: number;
};
export type Clues = { constraints: Constraint[]; easy: Moves; easyClues: EasyClue[] };
type Component = { constraints: Constraint[]; variables: number[] };
export type State = {
  cells: readonly Cell[];
  knownMines: Uint8Array;
  knownSafe: Uint8Array;
  neighbors: number[][];
  revealed: Uint8Array;
  revealedCount: number;
};

// A capped search may reject a solvable candidate, but cannot certify an unsolvable one.
const MAX_SEARCH_NODES = 50_000;

/** Build constraints and immediate deductions from revealed clues, rejecting contradictions. */
export const clueConstraints = (state: State): Clues | null => {
  const constraints: Constraint[] = [];
  const easy: Moves = { mines: [], safe: [] };
  const easyClues: EasyClue[] = [];
  for (let index = 0; index < state.cells.length; index += 1) {
    if (!state.revealed[index]) {
      continue;
    }
    const hidden = state.neighbors[index].filter(
      (neighbor) =>
        !state.revealed[neighbor] && !state.knownMines[neighbor] && !state.knownSafe[neighbor],
    );
    const provenMineIndices = state.neighbors[index].filter(
      (neighbor) => state.knownMines[neighbor],
    );
    const provenSafeIndices = state.neighbors[index].filter(
      (neighbor) => state.knownSafe[neighbor],
    );
    const mines = state.cells[index].adjacent - provenMineIndices.length;
    if (mines < 0 || mines > hidden.length) {
      return null;
    }
    if (hidden.length === 0) {
      continue;
    }
    if (mines === 0 || mines === hidden.length) {
      const kind = mines === 0 ? 'safe' : 'mine';
      easy[kind === 'safe' ? 'safe' : 'mines'].push(...hidden);
      easyClues.push({
        clueIndex: index,
        hidden,
        kind,
        provenMineIndices,
        provenSafeIndices,
        remainingMines: mines,
      });
    } else {
      constraints.push({ cells: hidden, clueIndex: index, mines });
    }
  }
  return { constraints, easy, easyClues };
};

/** Find cells with the same value in every solution, returning null if invalid or over budget. */
export const enumerateForced = (
  constraints: readonly Constraint[],
  variables: readonly number[],
  maxNodes = MAX_SEARCH_NODES,
): Moves | null => {
  const positions = new Map(variables.map((index, position) => [index, position]));
  const local = constraints.map(({ cells, mines }) => ({
    cells: cells.map((index) => {
      const position = positions.get(index);
      if (position === undefined) {
        throw new Error('Constraint partition omitted a cell.');
      }
      return position;
    }),
    mines,
  }));
  const affected = variables.map(() => [] as number[]);
  local.forEach(({ cells }, constraintIndex) => {
    for (const position of cells) {
      affected[position].push(constraintIndex);
    }
  });
  const order = variables
    .map((_, index) => index)
    .toSorted((left, right) => affected[right].length - affected[left].length);
  const remaining = local.map(({ cells }) => cells.length);
  const assignedMines = local.map(() => 0);
  const assignment = new Uint8Array(variables.length);
  const seenSafe = new Uint8Array(variables.length);
  const seenMine = new Uint8Array(variables.length);
  let solutions = 0;
  let nodes = 0;
  let allAmbiguous = false;
  /** Record which cells are safe or mined in this valid assignment. */
  const recordSolution = () => {
    solutions += 1;
    for (let position = 0; position < variables.length; position += 1) {
      if (assignment[position]) {
        seenMine[position] = 1;
      } else {
        seenSafe[position] = 1;
      }
    }
    allAmbiguous = variables.every((_, position) => seenSafe[position] && seenMine[position]);
  };
  /** Assign a cell and check whether its constraints can still be satisfied. */
  const assign = (position: number, value: number): boolean => {
    assignment[position] = value;
    let valid = true;
    for (const constraintIndex of affected[position]) {
      remaining[constraintIndex] -= 1;
      assignedMines[constraintIndex] += value;
      const required = local[constraintIndex].mines;
      if (
        assignedMines[constraintIndex] > required ||
        assignedMines[constraintIndex] + remaining[constraintIndex] < required
      ) {
        valid = false;
      }
    }
    return valid;
  };
  /** Restore constraint counts after exploring a cell assignment. */
  const undo = (position: number, value: number) => {
    for (const constraintIndex of affected[position]) {
      remaining[constraintIndex] += 1;
      assignedMines[constraintIndex] -= value;
    }
  };

  /** Explore valid assignments until the search limit or all cells are ambiguous. */
  const visit = (depth: number): void => {
    if (nodes > maxNodes || allAmbiguous) {
      return;
    }
    nodes += 1;
    if (nodes > maxNodes) {
      return;
    }
    if (depth === order.length) {
      recordSolution();
      return;
    }
    const position = order[depth];
    for (const value of [0, 1]) {
      if (assign(position, value)) {
        visit(depth + 1);
      }
      undo(position, value);
    }
  };
  visit(0);
  if (nodes > maxNodes || solutions === 0) {
    return null;
  }
  return {
    mines: variables.filter((_, position) => !seenSafe[position]),
    safe: variables.filter((_, position) => !seenMine[position]),
  };
};

/** Collect cells and constraints connected to one starting cell, marking cells visited. */
const connectedComponent = (
  first: number,
  byVariable: ReadonlyMap<number, number[]>,
  constraints: readonly Constraint[],
  visited: Set<number>,
): { constraintIndices: Set<number>; variables: number[] } => {
  const pending = [first];
  const variables: number[] = [];
  const constraintIndices = new Set<number>();
  visited.add(first);
  while (pending.length > 0) {
    const index = pending.pop();
    if (index === undefined) {
      continue;
    }
    variables.push(index);
    for (const constraintIndex of byVariable.get(index) ?? []) {
      constraintIndices.add(constraintIndex);
      for (const neighbor of constraints[constraintIndex].cells) {
        if (!visited.has(neighbor)) {
          visited.add(neighbor);
          pending.push(neighbor);
        }
      }
    }
  }
  return { constraintIndices, variables };
};

/** Split constraints into independent groups linked by shared cells. */
export const constraintComponents = (constraints: readonly Constraint[]): Component[] => {
  const byVariable = new Map<number, number[]>();
  constraints.forEach(({ cells }, constraintIndex) => {
    for (const index of cells) {
      const uses = byVariable.get(index) ?? [];
      uses.push(constraintIndex);
      byVariable.set(index, uses);
    }
  });
  const visited = new Set<number>();
  const components: Component[] = [];
  for (const first of byVariable.keys()) {
    if (visited.has(first)) {
      continue;
    }
    const { constraintIndices, variables } = connectedComponent(
      first,
      byVariable,
      constraints,
      visited,
    );
    const members = [...constraintIndices].map((index) => constraints[index]);
    components.push({
      constraints: members,
      variables,
    });
  }
  return components;
};

/** Return forced moves from the first independent group that yields a deduction. */
const constrainedMoves = (constraints: readonly Constraint[]): Moves | null => {
  for (const component of constraintComponents(constraints)) {
    const moves = enumerateForced(component.constraints, component.variables);
    if (moves && (moves.safe.length > 0 || moves.mines.length > 0)) {
      return moves;
    }
  }
  return null;
};

/** List hidden cells that have not been proven safe or mined. */
export const unknownCells = (state: State): number[] =>
  state.cells
    .map((_, index) => index)
    .filter(
      (index) => !state.revealed[index] && !state.knownMines[index] && !state.knownSafe[index],
    );

/** Find the next forced moves using the total mine count, clues, or constraint search. */
export const nextMoves = (state: State, config: GameConfig): Moves | null => {
  const unknown = unknownCells(state);
  const remainingMines = config.mines - state.knownMines.reduce((total, known) => total + known, 0);
  if (remainingMines < 0 || remainingMines > unknown.length) {
    return null;
  }
  if (remainingMines === 0) {
    return { mines: [], safe: unknown };
  }
  if (remainingMines === unknown.length) {
    return { mines: unknown, safe: [] };
  }
  const clues = clueConstraints(state);
  if (!clues) {
    return null;
  }
  return clues.easy.safe.length > 0 || clues.easy.mines.length > 0
    ? clues.easy
    : constrainedMoves(clues.constraints);
};
