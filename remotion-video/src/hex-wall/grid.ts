/** Deterministic pointy-top hexagon grid, centred on the origin. */

import { COL_SPACING, GRID_COLS, GRID_ROWS, ROW_SPACING } from "./constants";

export type Tile = {
  readonly x: number;
  readonly y: number;
  /** Distance from the centre of the wall - drives the wave. */
  readonly radius: number;
  /** Stable per-tile value in 0..1. */
  readonly jitter: number;
};

/** Small integer hash so the same tile always gets the same jitter. */
const hash = (col: number, row: number) => {
  let h = (col * 73856093) ^ (row * 19349663) ^ 0x9e3779b9;
  h = Math.imul(h ^ (h >>> 16), 2246822507);
  h = Math.imul(h ^ (h >>> 13), 3266489909);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};

export const buildGrid = (): Tile[] => {
  const tiles: Tile[] = [];
  const halfCols = (GRID_COLS - 1) / 2;
  const halfRows = (GRID_ROWS - 1) / 2;

  for (let row = 0; row < GRID_ROWS; row++) {
    // Every other row slides half a column across so the tiles interlock.
    const stagger = row % 2 === 0 ? 0 : COL_SPACING / 2;
    for (let col = 0; col < GRID_COLS; col++) {
      const x = (col - halfCols) * COL_SPACING + stagger;
      const y = (row - halfRows) * ROW_SPACING;
      tiles.push({
        x,
        y,
        radius: Math.hypot(x, y),
        jitter: hash(col, row),
      });
    }
  }

  return tiles;
};
