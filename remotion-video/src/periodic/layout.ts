import { ELEMENTS, type PeriodicElement } from "./elements";

export const FRAME_WIDTH = 3840;
export const FRAME_HEIGHT = 2160;

export const FPS = 30;
export const DURATION_IN_FRAMES = 300;
/** Frame the assembly finishes / the hold begins. */
export const HOLD_START = 150;

export const COLUMNS = 18;
/** Distance between the top-left corners of two neighbouring cells. */
export const CELL_PITCH = 170;
export const CELL_SIZE = 152;
export const CELL_RADIUS = 14;

/**
 * 18 columns spanning 17 * 170 + 152 = 3042px, i.e. 79% of the 3840px frame.
 */
export const GRID_WIDTH = (COLUMNS - 1) * CELL_PITCH + CELL_SIZE;

/** Vertical gap between the main block and the f-block rows, in pitches. */
const F_BLOCK_GAP = 0.6;
/** Row indices: 0-6 are periods 1-7, then the two detached f-block rows. */
const F_BLOCK_ROWS = [7 + F_BLOCK_GAP, 8 + F_BLOCK_GAP];
/** The f-block rows are offset right so they start under group 4. */
const F_BLOCK_FIRST_COLUMN = 4;

const GRID_HEIGHT = F_BLOCK_ROWS[1] * CELL_PITCH + CELL_SIZE;

export const GRID_X = (FRAME_WIDTH - GRID_WIDTH) / 2;
export const GRID_Y = (FRAME_HEIGHT - GRID_HEIGHT) / 2;

export type PlacedElement = PeriodicElement & {
  /** Top-left corner of the cell in viewBox units. */
  x: number;
  y: number;
  /** Centre of the cell in viewBox units. */
  cx: number;
  cy: number;
};

const place = (element: PeriodicElement): PlacedElement => {
  let column: number;
  let row: number;

  if (element.group === null) {
    // Detached f-block: Ce (58) and Th (90) open their rows, so the offset is
    // counted from La (57) / Ac (89), which stay in the main block.
    const seriesStart = element.period === 6 ? 57 : 89;
    column = F_BLOCK_FIRST_COLUMN + (element.atomicNumber - seriesStart - 1);
    row = F_BLOCK_ROWS[element.period === 6 ? 0 : 1];
  } else {
    column = element.group;
    row = element.period - 1;
  }

  const x = GRID_X + (column - 1) * CELL_PITCH;
  const y = GRID_Y + row * CELL_PITCH;

  return { ...element, x, y, cx: x + CELL_SIZE / 2, cy: y + CELL_SIZE / 2 };
};

export const PLACED_ELEMENTS: PlacedElement[] = ELEMENTS.map(place);
