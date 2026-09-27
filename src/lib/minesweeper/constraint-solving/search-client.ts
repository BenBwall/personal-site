import type { SearchProgress } from '$lib/minesweeper/constraint-solving/search-settings';
import type {
  SearchRequest,
  SearchResponse,
} from '$lib/minesweeper/constraint-solving/solvable-game.worker';
import { type Game, revealCell } from '$lib/minesweeper/game';
import { on } from 'svelte/events';

/** Keep the page responsive and search until a board is found or the user interrupts. */
export const startSolvableGameSearch = (
  game: Game,
  index: number,
  onProgress: (progress: SearchProgress) => void,
) => {
  const worker = new Worker(new URL('./solvable-game.worker.ts', import.meta.url), {
    type: 'module',
  });
  let cancel: (() => void) | undefined;
  let useRandomBoard: (() => void) | undefined;
  const result = new Promise<Game | null>((resolve, reject) => {
    let finished = false;
    const finish = (next: Game | null, error?: Error) => {
      if (finished) {
        return;
      }
      finished = true;
      stopMessages();
      stopErrors();
      worker.terminate();
      if (error) {
        reject(error);
      } else {
        resolve(next);
      }
    };
    cancel = () => {
      finish(null);
    };
    useRandomBoard = () => {
      if (finished) {
        return;
      }
      worker.terminate();
      try {
        finish(
          revealCell({ ...game, config: { ...game.config, noGuessingRequired: false } }, index),
        );
      } catch (error) {
        finish(
          null,
          error instanceof Error ? error : new Error('Could not create a random board.'),
        );
      }
    };
    const stopMessages = on(worker, 'message', (event) => {
      // This private worker's message protocol is SearchResponse; on() exposes only Event.
      // oxlint-disable-next-line typescript/no-unsafe-type-assertion
      const { data } = event as MessageEvent<SearchResponse>;
      if (data.kind === 'progress') {
        onProgress(data.progress);
      } else if (data.kind === 'complete') {
        finish(data.game);
      } else {
        finish(null, new Error(data.message));
      }
    });
    const stopErrors = on(worker, 'error', () => {
      finish(null, new Error('Could not start the solvable game finder. Try again.'));
    });
    try {
      // Workers do not accept a window targetOrigin argument.
      // oxlint-disable-next-line unicorn/require-post-message-target-origin
      worker.postMessage({ game, index } satisfies SearchRequest);
    } catch (error) {
      finish(null, error instanceof Error ? error : new Error('Could not start this search.'));
    }
  });
  return { cancel: () => cancel?.(), result, useRandomBoard: () => useRandomBoard?.() };
};
