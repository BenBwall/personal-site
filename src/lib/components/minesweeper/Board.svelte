<script lang="ts">
  import {
    HINT_ROLE_LABELS,
    type HintRole,
    columnLabel,
    coordinateLabel,
    positionLabel,
  } from '$lib/components/minesweeper/presentation';
  import type { Cell, Game } from '$lib/minesweeper/game';
  import { onMount } from 'svelte';
  import { on } from 'svelte/events';
  type Props = {
    game: Game;
    menuOpen: boolean;
    storageReady: boolean;
    searching: boolean;
    showSearchScreen: boolean;
    activeHintRoles: ReadonlyMap<number, HintRole>;
    activeHintIndex: number | undefined;
    scrollToRestore: { left: number; top: number } | null;
    onreveal: (index: number) => void;
    onflag: (index: number) => void;
    onscrollposition: (left: number, top: number) => void;
  };
  let {
    game,
    menuOpen,
    storageReady,
    searching,
    showSearchScreen,
    activeHintRoles,
    activeHintIndex,
    scrollToRestore,
    onreveal,
    onflag,
    onscrollposition,
  }: Props = $props();
  const DRAG_START_DISTANCE_PX = 5;
  const TOUCH_HOLD_DELAY_MS = 500;
  const TOUCH_HOLD_MOVE_TOLERANCE_PX = 10;
  let boardScrollElement: HTMLDivElement;
  let boardDrag:
    | {
        pointerId: number;
        startX: number;
        startY: number;
        scrollLeft: number;
        scrollTop: number;
        horizontal: boolean;
        vertical: boolean;
        dragging: boolean;
      }
    | undefined;
  let isDragging = $state(false);
  let suppressDraggedClick = false;
  let touchHold: { pointerId: number; startX: number; startY: number; timer: number } | undefined;
  let suppressTouchClick = false;
  const gameEnded = $derived(game.phase === 'won' || game.phase === 'lost');
  const minBoardWidthRem = $derived(
    game.config.columns * 2 + Math.max(2, String(game.config.rows).length * 0.75),
  );
  $effect(() => {
    if (storageReady && boardScrollElement && scrollToRestore) {
      const { left, top } = scrollToRestore;
      let frame = window.requestAnimationFrame(() => {
        // Restore scrolling after the saved board has completed layout.
        frame = window.requestAnimationFrame(() => boardScrollElement.scrollTo(left, top));
      });
      return () => window.cancelAnimationFrame(frame);
    }
  });
  $effect(() => {
    if (menuOpen || searching || gameEnded) {
      cancelTouchHold();
    }
  });
  onMount(() => {
    const unsubscribeBlur = on(window, 'blur', cancelTouchHold);
    const unsubscribeHidden = on(document, 'visibilitychange', () => {
      if (document.hidden) {
        cancelTouchHold();
      }
    });
    return () => {
      cancelTouchHold();
      unsubscribeBlur();
      unsubscribeHidden();
    };
  });
  export const scrollToCell = (index: number | undefined) => {
    if (index === undefined || !boardScrollElement) {
      return;
    }
    const cell = boardScrollElement.querySelector<HTMLButtonElement>(
      `[data-cell-index="${index}"]`,
    );
    if (!cell) {
      return;
    }
    const viewport = boardScrollElement.getBoundingClientRect();
    const target = cell.getBoundingClientRect();
    boardScrollElement.scrollBy({
      behavior: document.documentElement.dataset.reducedMotion === 'true' ? 'auto' : 'smooth',
      left: target.left + target.width / 2 - viewport.left - viewport.width / 2,
      top: target.top + target.height / 2 - viewport.top - viewport.height / 2,
    });
  };
  const cancelTouchHold = () => {
    if (touchHold) {
      window.clearTimeout(touchHold.timer);
      touchHold = undefined;
    }
  };
  const flagCell = (index: number) => onflag(index);
  const beginBoardPointer = (event: PointerEvent) => {
    cancelTouchHold();
    suppressTouchClick = !event.isPrimary;
    if (event.button !== 0 || !event.isPrimary) {
      return;
    }
    if (event.pointerType === 'touch') {
      const cell =
        event.target instanceof Element
          ? event.target.closest<HTMLButtonElement>('button[data-cell-index]')
          : null;
      if (!cell || cell.disabled || searching || menuOpen || gameEnded) {
        return;
      }
      const index = Number(cell.dataset.cellIndex);
      if (game.cells[index].revealed) {
        return;
      }
      touchHold = {
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        timer: window.setTimeout(() => {
          // Keep suppressing the release click, including after removing a flag.
          suppressTouchClick = true;
          flagCell(index);
        }, TOUCH_HOLD_DELAY_MS),
      };
      return;
    }
    const horizontal = boardScrollElement.scrollWidth > boardScrollElement.clientWidth;
    const vertical = boardScrollElement.scrollHeight > boardScrollElement.clientHeight;
    if (!horizontal && !vertical) {
      return;
    }
    boardDrag = {
      dragging: false,
      horizontal,
      pointerId: event.pointerId,
      scrollLeft: boardScrollElement.scrollLeft,
      scrollTop: boardScrollElement.scrollTop,
      startX: event.clientX,
      startY: event.clientY,
      vertical,
    };
  };

  const moveBoardPointer = (event: PointerEvent) => {
    if (
      touchHold?.pointerId === event.pointerId &&
      Math.hypot(event.clientX - touchHold.startX, event.clientY - touchHold.startY) >
        TOUCH_HOLD_MOVE_TOLERANCE_PX
    ) {
      cancelTouchHold();
      suppressTouchClick = true;
    }
    if (!boardDrag || event.pointerId !== boardDrag.pointerId || !(event.buttons & 1)) {
      return;
    }
    const deltaX = event.clientX - boardDrag.startX;
    const deltaY = event.clientY - boardDrag.startY;
    if (
      !boardDrag.dragging &&
      Math.hypot(boardDrag.horizontal ? deltaX : 0, boardDrag.vertical ? deltaY : 0) <
        DRAG_START_DISTANCE_PX
    ) {
      return;
    }
    if (!boardDrag.dragging) {
      boardDrag.dragging = true;
      isDragging = true;
      boardScrollElement.setPointerCapture(event.pointerId);
    }
    event.preventDefault();
    boardScrollElement.scrollLeft = boardDrag.scrollLeft - deltaX;
    boardScrollElement.scrollTop = boardDrag.scrollTop - deltaY;
  };

  const endBoardPointer = (event: PointerEvent) => {
    if (touchHold?.pointerId === event.pointerId) {
      cancelTouchHold();
    }
    if (!boardDrag || event.pointerId !== boardDrag.pointerId) {
      return;
    }
    if (boardDrag.dragging) {
      suppressDraggedClick = true;
      window.setTimeout(() => {
        suppressDraggedClick = false;
      }, 0);
    }
    boardDrag = undefined;
    isDragging = false;
  };
  const cellLabel = (cell: Cell, index: number, currentGame: Game): string => {
    const position = positionLabel(index, currentGame.config);
    if (currentGame.phase === 'lost' && cell.mine) {
      return `${position}: mine`;
    }
    if (currentGame.phase === 'lost' && cell.flagged) {
      return `${position}: incorrect flag`;
    }
    if (cell.flagged) {
      return `${position}: flagged`;
    }
    if (!cell.revealed) {
      return `${position}: hidden`;
    }
    if (cell.adjacent === 0) {
      return `${position}: empty`;
    }
    return currentGame.phase === 'playing'
      ? `${position}: ${cell.adjacent} nearby mines. Activate to reveal unflagged neighbors when flags match.`
      : `${position}: ${cell.adjacent} nearby mines`;
  };

  const cellContent = (cell: Cell, currentGame: Game): string => {
    if (currentGame.phase === 'lost' && cell.flagged && !cell.mine) {
      return '×';
    }
    if (cell.flagged) {
      return '⚑';
    }
    if ((currentGame.phase === 'lost' && cell.mine) || (cell.revealed && cell.mine)) {
      return '✹';
    }
    if (cell.revealed && cell.adjacent > 0) {
      return String(cell.adjacent);
    }
    return '';
  };
</script>

<div
  bind:this={boardScrollElement}
  class="board-scroll"
  class:inactive={menuOpen || !storageReady || showSearchScreen}
  class:dragging={isDragging}
  role="region"
  aria-label="Scrollable game board"
  inert={menuOpen || !storageReady || searching}
  aria-busy={searching}
  onpointerdown={beginBoardPointer}
  onpointermove={moveBoardPointer}
  onpointerup={endBoardPointer}
  onpointercancel={endBoardPointer}
  onlostpointercapture={endBoardPointer}
  onpointerleave={() => {
    cancelTouchHold();
    if (boardDrag && !boardDrag.dragging) boardDrag = undefined;
  }}
  onclickcapture={(event) => {
    if ((suppressDraggedClick || suppressTouchClick) && event.detail !== 0) {
      event.preventDefault();
      event.stopPropagation();
      suppressDraggedClick = false;
    }
  }}
  onscroll={(event) => {
    cancelTouchHold();
    onscrollposition(event.currentTarget.scrollLeft, event.currentTarget.scrollTop);
  }}
>
  <div
    class="board"
    class:won={game.phase === 'won'}
    role="group"
    aria-label={`Minesweeper board, ${game.config.rows} rows and ${game.config.columns} columns${game.phase === 'won' ? ', won' : ''}`}
    style:grid-template-columns={`minmax(2rem, max-content) repeat(${game.config.columns}, minmax(0, 1fr))`}
    style:min-width={`${minBoardWidthRem}rem`}
  >
    <span class="board-corner" aria-hidden="true">{game.phase === 'won' ? '✓' : ''}</span>
    {#each Array.from({ length: game.config.columns }, (_, index) => index) as column (column)}
      <span class="board-coordinate column-coordinate" aria-hidden="true">
        {columnLabel(column)}
      </span>
    {/each}
    {#each game.cells as cell, index (index)}
      {const hintRole = $derived(activeHintRoles.get(index))}
      {#if index % game.config.columns === 0}
        <span class="board-coordinate row-coordinate" aria-hidden="true">
          {Math.floor(index / game.config.columns) + 1}
        </span>
      {/if}
      <button
        type="button"
        class="cell"
        class:revealed={cell.revealed || (game.phase === 'lost' && cell.mine)}
        class:flagged={cell.flagged}
        class:mine={game.phase === 'lost' && cell.mine}
        class:detonated={game.detonatedIndex === index}
        class:incorrect={game.phase === 'lost' && cell.flagged && !cell.mine}
        data-hint-role={hintRole}
        data-cell-index={index}
        data-adjacent={cell.revealed && !cell.mine ? cell.adjacent : undefined}
        aria-label={`${cellLabel(cell, index, game)}${hintRole ? `; hint: ${HINT_ROLE_LABELS[hintRole]}` : ''}`}
        title={hintRole
          ? `${coordinateLabel(index, game.config)} · ${HINT_ROLE_LABELS[hintRole]}`
          : undefined}
        aria-describedby={hintRole === 'wrong-flag'
          ? `flag-explanation-${index}`
          : activeHintIndex === index
            ? 'current-game-hint'
            : undefined}
        disabled={menuOpen ||
          searching ||
          game.phase === 'won' ||
          game.phase === 'lost' ||
          (cell.revealed && cell.adjacent === 0)}
        onclick={() => onreveal(index)}
        oncontextmenu={(event) => {
          event.preventDefault();
          // Mobile browsers may also emit a context menu during a touch hold.
          if (
            touchHold ||
            suppressTouchClick ||
            ('pointerType' in event && event.pointerType === 'touch')
          ) {
            return;
          }
          flagCell(index);
        }}
      >
        <span aria-hidden="true">{cellContent(cell, game)}</span>
        {#if hintRole === 'wrong-flag'}
          <span class="wrong-flag-mark" aria-hidden="true">×</span>
        {/if}
      </button>
    {/each}
  </div>
</div>

<style>
  .board-scroll.inactive {
    max-height: 32rem;
    overflow: hidden;
    opacity: 0.6;
    filter: blur(1px);
    pointer-events: none;
  }

  .board-scroll {
    max-width: 100%;
    max-height: 70rem;
    min-width: 0;
    overflow: auto;
    scrollbar-width: thin;
    cursor: grab;
  }

  .board-scroll.dragging,
  .board-scroll.dragging .cell {
    cursor: grabbing;
  }

  .board {
    --board-surface: light-dark(var(--color-200), var(--color-800));

    display: grid;
    gap: 0.1875rem;
    width: 100%;
    box-sizing: border-box;
    padding: 0.1875rem;
    border: 1px solid var(--theme-border-color);
    border-radius: 0.5rem;
    background: var(--board-surface);
  }

  .board,
  .board * {
    /* Prevent iOS text selection and callouts when holding a cell to flag it. */
    -webkit-touch-callout: none;
    -webkit-user-select: none;
    user-select: none;
  }

  .board.won {
    --board-surface: light-dark(
      color-mix(in srgb, var(--color-complement-300) 40%, var(--color-200)),
      color-mix(in srgb, var(--color-complement-700) 40%, var(--color-800))
    );

    border-color: light-dark(var(--color-complement-600), var(--color-complement-400));
    box-shadow: 0 0 0 2px light-dark(var(--color-complement-300), var(--color-complement-700));
  }

  .board.won .board-corner {
    display: grid;
    place-items: center;
    color: light-dark(var(--color-complement-700), var(--color-complement-300));
    font-size: 1.125rem;
    font-weight: 700;
  }

  .board-corner,
  .board-coordinate {
    background: var(--board-surface);
    box-shadow: 0 0 0 2px var(--board-surface);
  }

  .board-corner {
    position: sticky;
    z-index: 3;
    top: 0;
    left: 0;
  }

  .column-coordinate {
    position: sticky;
    z-index: 2;
    top: 0;
  }

  .row-coordinate {
    position: sticky;
    z-index: 1;
    left: 0;
  }

  .board-coordinate {
    display: grid;
    place-items: center;
    min-width: 0;
    padding-inline: 0.25rem;
    color: light-dark(var(--color-700), var(--color-300));
    font-size: 0.75rem;
    font-weight: 600;
    font-variant-numeric: tabular-nums;
    line-height: 1;
  }

  .cell {
    position: relative;
    display: grid;
    place-items: center;
    min-width: 0;
    aspect-ratio: 1;
    padding: 0;
    border: 1px solid var(--theme-border-color);
    border-radius: 0.25rem;
    background: light-dark(var(--color-50), var(--color-900));
    color: light-dark(var(--color-700), var(--color-300));
    font:
      700 clamp(0.875rem, 3vw, 1.25rem) / 1 system-ui,
      sans-serif;
    cursor: pointer;
    touch-action: manipulation;
  }

  .cell:not(:disabled):hover {
    background: light-dark(var(--color-100), var(--color-800));
  }

  .cell:disabled {
    opacity: 1;
    cursor: default;
  }

  .cell.revealed {
    border-color: transparent;
    background: light-dark(var(--color-100), var(--color-950));
  }

  .cell.flagged {
    color: light-dark(var(--color-complement-700), var(--color-complement-300));
  }

  .board.won .cell.flagged {
    border-color: light-dark(var(--color-complement-400), var(--color-complement-600));
    background: light-dark(var(--color-complement-100), var(--color-complement-900));
  }

  .cell.mine,
  .cell.incorrect {
    color: light-dark(var(--color-offset-120-700), var(--color-offset-120-300));
  }

  .cell.detonated {
    background: light-dark(var(--color-offset-120-100), var(--color-offset-120-900));
  }

  .cell[data-hint-role='wrong-flag'] {
    color: var(--hint-stroke);
  }

  .wrong-flag-mark {
    position: absolute;
    top: 0.1rem;
    right: 0.15rem;
    font-size: 0.75rem;
  }

  .cell[data-hint-role],
  .cell[data-hint-role]:not(:disabled):hover {
    border-color: var(--hint-stroke);
    background: var(--hint-fill);
    z-index: 1;
  }

  .cell[data-hint-role='undecided'],
  .cell[data-hint-role='undecided']:not(:disabled):hover {
    border-color: var(--theme-border-color);
  }

  .cell[data-hint-role^='target-'] {
    outline: 2px solid var(--hint-stroke);
    outline-offset: 1px;
    z-index: 2;
  }

  .cell[data-adjacent='2'],
  .cell[data-adjacent='5'],
  .cell[data-adjacent='8'] {
    color: light-dark(var(--color-offset-120-700), var(--color-offset-120-300));
  }

  .cell[data-adjacent='3'],
  .cell[data-adjacent='6'] {
    color: light-dark(var(--color-offset-240-700), var(--color-offset-240-300));
  }
</style>
