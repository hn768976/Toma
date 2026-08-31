/**
 * Turns a variant's spawn curve into the full, fixed list of dialogs: where
 * each one sits, how far it is rotated, and the frame it pops in on.
 *
 * Every value comes from Remotion's `random()` with a stable string seed, so
 * the list is byte-identical on every render and on every machine. There is no
 * Math.random() anywhere in the project.
 *
 * Positions are seeded but biased: the first dialog is dead centre, and the
 * pile works outward from there. Placement is jittered-stratified rather than
 * uniformly random — the frame is divided into cells, each dialog is dropped
 * somewhere inside its own cell, and the cells are visited in roughly
 * centre-outward order. Purely uniform sampling leaves Poisson holes that no
 * realistic dialog count closes, and the brief needs the background fully
 * buried by the end. Stratifying guarantees that and, because the jitter is
 * still random, it reads as scatter rather than as a grid.
 */

import { random } from "remotion";
import { HEIGHT, VARIANTS, WIDTH, type VariantName } from "./config";
import { buildSchedule } from "./spawn-curve";

export interface DialogInstance {
  spawnFrame: number;
  x: number;
  y: number;
  /** Radians. */
  rotation: number;
}

interface Point {
  x: number;
  y: number;
}

interface Grid {
  cols: number;
  rows: number;
  cellW: number;
  cellH: number;
  originX: number;
  originY: number;
  /** Jitter inside a cell, as a fraction of the cell, in each direction. */
  jitter: number;
}

/**
 * A grid fine enough that every dialog gets its own cell, capped so that a
 * jittered centre can never drift far enough from its neighbours to open a
 * gap: a point is always within half a dialog of some dialog's centre.
 */
const buildGrid = (count: number, halfW: number, halfH: number, dw: number, dh: number): Grid => {
  const spanX = halfW * 2;
  const spanY = halfH * 2;
  const cols = Math.max(1, Math.floor(Math.sqrt((count * spanX) / spanY)));
  const rows = Math.max(1, Math.floor(count / cols));
  const cellW = spanX / cols;
  const cellH = spanY / rows;
  const jitter = Math.max(
    0.12,
    Math.min(0.45, Math.min(dw / 2 / cellW, dh / 2 / cellH) - 0.5),
  );
  return {
    cols,
    rows,
    cellW,
    cellH,
    originX: WIDTH / 2 - halfW,
    originY: HEIGHT / 2 - halfH,
    jitter,
  };
};

const cellPosition = (grid: Grid, cell: number, seed: string): Point => {
  const col = cell % grid.cols;
  const row = Math.floor(cell / grid.cols);
  const jx = (random(`${seed}-jx`) * 2 - 1) * grid.jitter;
  const jy = (random(`${seed}-jy`) * 2 - 1) * grid.jitter;
  return {
    x: grid.originX + (col + 0.5 + jx) * grid.cellW,
    y: grid.originY + (row + 0.5 + jy) * grid.cellH,
  };
};

/**
 * Cells visited roughly centre-outward. The key is elliptical distance from
 * the frame centre plus a healthy dose of noise, so the fill spreads like
 * contagion rather than like a clean expanding ring.
 */
const orderCellsOutward = (grid: Grid, seedPrefix: string, halfW: number, halfH: number) => {
  const total = grid.cols * grid.rows;
  const keyed: { cell: number; key: number }[] = [];
  for (let cell = 0; cell < total; cell++) {
    const { x, y } = cellPosition(grid, cell, `${seedPrefix}-cell-${cell}`);
    const ndx = (x - WIDTH / 2) / halfW;
    const ndy = (y - HEIGHT / 2) / halfH;
    keyed.push({
      cell,
      key: Math.hypot(ndx, ndy) + 0.3 * random(`${seedPrefix}-order-${cell}`),
    });
  }
  keyed.sort((a, b) => a.key - b.key);
  return keyed.map((k) => k.cell);
};

export const buildDialogs = (variantName: VariantName): DialogInstance[] => {
  const variant = VARIANTS[variantName];
  const schedule = buildSchedule(variant.spawn);
  const count = schedule.length;

  // Let centres run past the frame edge so dialogs actually cover the corners.
  const halfW = WIDTH / 2 + variant.dialog.width * 0.34;
  const halfH = HEIGHT / 2 + variant.dialog.height * 0.62;
  const grid = buildGrid(count, halfW, halfH, variant.dialog.width, variant.dialog.height);
  const order = orderCellsOutward(grid, variantName, halfW, halfH);
  const jitterRad = (variant.rotationJitterDeg * Math.PI) / 180;

  return schedule.map((entry, i) => {
    const seed = `${variantName}-dialog-${i}`;
    let point: Point;
    if (i === 0) {
      // Alone, dead centre. The emptiness around it is the whole opening.
      point = { x: WIDTH / 2, y: HEIGHT / 2 };
    } else if (i < order.length) {
      point = cellPosition(grid, order[i], `${variantName}-cell-${order[i]}`);
    } else {
      // More dialogs than cells: the overflow piles on anywhere, which is
      // exactly what the tail of the flood should look like.
      const cell = order[Math.floor(random(`${seed}-cell`) * order.length)];
      point = cellPosition(grid, cell, seed);
    }

    return {
      spawnFrame: entry.spawnFrame,
      x: point.x,
      y: point.y,
      // Just enough tilt to break the grid. More and they stop reading as UI.
      rotation: (random(`${seed}-rot`) * 2 - 1) * jitterRad,
    };
  });
};
