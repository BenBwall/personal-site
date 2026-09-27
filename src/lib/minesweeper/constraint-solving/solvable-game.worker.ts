import { placeMines } from '$lib/minesweeper/constraint-solving/find-solvable-games';
import type { SearchProgress } from '$lib/minesweeper/constraint-solving/search-settings';
import { type Game, revealCell } from '$lib/minesweeper/game';

export type SearchRequest = { game: Game; index: number };
export type SearchResponse =
  | { kind: 'progress'; progress: SearchProgress }
  | { game: Game; kind: 'complete' }
  | { kind: 'error'; message: string };

const send = (message: SearchResponse) => {
  postMessage(message);
};

onmessage = ({ data }: MessageEvent<SearchRequest>) => {
  const { game, index } = data;
  let lastReportAt = -Infinity;
  let lastPhase: SearchProgress['phase'] | undefined;
  try {
    const cells = placeMines(game.cells, index, game.config, Math.random, (progress) => {
      if (progress.phase !== lastPhase || progress.elapsedMs - lastReportAt >= 100) {
        send({ kind: 'progress', progress });
        lastReportAt = progress.elapsedMs;
        lastPhase = progress.phase;
      }
    });
    send({ game: revealCell({ ...game, cells, phase: 'playing' }, index), kind: 'complete' });
  } catch (error) {
    send({
      kind: 'error',
      message: error instanceof Error ? error.message : 'Could not create this board.',
    });
  }
};
