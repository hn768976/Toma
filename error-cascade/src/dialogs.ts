/**
 * Turns a variant's spawn curve into the full, fixed list of dialogs: where
 * each one sits, how far it is rotated, and the frame it pops in on.
 *
 * Every value comes from Remotion's `random()` with a stable string seed, so
 * the list is byte-identical on every render and on every machine. There is no
 * Math.random() anywhere in the project.
 *
 * Placement sits on a jittered-stratified grid. The frame is divided
 * into cells small enough that a dialog dropped anywhere inside a cell still
 * reaches its neighbours, so once every cell has been claimed the background
 * is completely buried. Purely uniform sampling leaves Poisson holes that no
 * realistic dialog count closes, and the piece has to end fully covered.
 * The jitter inside each cell is what keeps it reading as scatter rather than
 * as a grid.
 *
 *   >>> layout:radial
 *   "radial"    — one cell per dialog, visited roughly centre-outward. v1's
 *                 leak spreading from a single dialog at the centre.
 *   <<< layout:radial
 *   >>> layout:clustered
 *   "clustered" — coarse cells, several dialogs deep. Each burst claims a
 *                 compact blob of cells around its own seeded centre, so
 *                 coverage builds as overlapping patches. v2's attacks.
 *   <<< layout:clustered
 */

import { random } from "remotion";
import { HEIGHT, VARIANTS, WIDTH, type VariantName } from "./config";
import { buildSchedule, type ScheduledDialog } from "./spawn-curve";

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

/** How far a jittered centre may sit from its cell centre, per axis. */
const MAX_JITTER = 0.3;

/**
 * `target` is the cell count the layout would like; the grid never goes
 * coarser than the coverage guarantee, and never finer than `capacity`
 * dialogs can claim — unclaimed cells are exactly where holes appear.
 */
const buildGrid = (
  target: number,
  capacity: number,
  halfW: number,
  halfH: number,
  dw: number,
  dh: number,
): Grid => {
  const spanX = halfW * 2;
  const spanY = halfH * 2;
  const minCols = Math.ceil(spanX / (dw / 2 / (0.5 + MAX_JITTER)));
  const minRows = Math.ceil(spanY / (dh / 2 / (0.5 + MAX_JITTER)));

  let cols = minCols;
  let rows = minRows;
  if (target > minCols * minRows) {
    cols = Math.max(minCols, Math.round(Math.sqrt((target * spanX) / spanY)));
    rows = Math.max(minRows, Math.round(target / cols));
  }
  if (cols * rows > capacity) {
    cols = Math.max(minCols, Math.min(cols, Math.floor(capacity / rows)));
    rows = Math.max(minRows, Math.min(rows, Math.floor(capacity / cols)));
  }

  const cellW = spanX / cols;
  const cellH = spanY / rows;
  return {
    cols,
    rows,
    cellW,
    cellH,
    originX: WIDTH / 2 - halfW,
    originY: HEIGHT / 2 - halfH,
    jitter: Math.max(0.12, Math.min(MAX_JITTER, Math.min(dw / 2 / cellW, dh / 2 / cellH) - 0.5)),
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

/** Elliptical distance from the frame centre, so the fill reaches all four
 *  edges at about the same time instead of hitting the sides first. */
const centreDistance = (p: Point, halfW: number, halfH: number) =>
  Math.hypot((p.x - WIDTH / 2) / halfW, (p.y - HEIGHT / 2) / halfH);

interface LayoutArgs {
  grid: Grid;
  points: Point[];
  schedule: ScheduledDialog[];
  seedPrefix: string;
  halfW: number;
  halfH: number;
  density: [number, number];
}

type LayoutFn = (args: LayoutArgs) => number[];

// >>> layout:radial — dropped from the dark-only bundle by scripts/package.mjs
/**
 * v1: cells visited roughly centre-outward. The sort key is that distance
 * plus a healthy dose of noise, so the fill spreads like contagion rather than
 * like a clean expanding ring.
 */
const radialCells: LayoutFn = ({ points, seedPrefix, halfW, halfH }) =>
  points
    .map((p, cell) => ({
      cell,
      key: centreDistance(p, halfW, halfH) + 0.3 * random(`${seedPrefix}-order-${cell}`),
    }))
    .sort((a, b) => a.key - b.key)
    .map((k) => k.cell);
// <<< layout:radial

// >>> layout:clustered — dropped from the light-only bundle by scripts/package.mjs
/**
 * v2: one compact blob of cells per burst.
 *
 * Each burst opens somewhere still empty — early ones near the centre, later
 * ones wherever is left — and then claims the cells nearest that opening,
 * unclaimed first. Once the frame runs out of empty cells, bursts start
 * landing on top of earlier ones, which is exactly how the coverage should
 * build: patches, then patches over patches.
 */
const clusteredCells: LayoutFn = ({
  grid,
  points,
  schedule,
  seedPrefix,
  halfW,
  halfH,
  density,
}) => {
  const cellCount = points.length;
  const claimed = new Uint8Array(cellCount);
  const claimedCells: number[] = [];
  const assignment = new Array<number>(schedule.length);

  // Dialog indices belonging to each burst, in spawn order.
  const bursts = new Map<number, number[]>();
  schedule.forEach((entry, i) => {
    const list = bursts.get(entry.group);
    if (list) {
      list.push(i);
    } else {
      bursts.set(entry.group, [i]);
    }
  });

  const groups = [...bursts.keys()].sort((a, b) => a - b);
  const lastGroup = Math.max(1, groups.length - 1);
  const cellDiagonal = Math.hypot(grid.cellW, grid.cellH);

  groups.forEach((group, gi) => {
    const members = bursts.get(group) as number[];
    const outward = gi / lastGroup;

    // Where this burst lands. Two pulls, plus noise so it is never the same
    // answer twice: toward the centre of the frame, strongly for the first
    // bursts and not at all for the last, and away from ground an earlier
    // burst has already taken. The second pull is what makes each burst land
    // in its own region instead of creeping outward from the previous one.
    const separation = new Float64Array(cellCount);
    for (let cell = 0; cell < cellCount; cell++) {
      if (claimedCells.length === 0) {
        separation[cell] = 1;
        continue;
      }
      let nearest = Infinity;
      for (const other of claimedCells) {
        const dx = points[cell].x - points[other].x;
        const dy = points[cell].y - points[other].y;
        nearest = Math.min(nearest, Math.hypot(dx, dy));
      }
      separation[cell] = Math.min(1, nearest / (WIDTH * 0.25));
    }

    let origin = -1;
    let bestKey = Infinity;
    for (let cell = 0; cell < cellCount; cell++) {
      if (claimed[cell]) {
        continue;
      }
      const key =
        centreDistance(points[cell], halfW, halfH) * (1 - outward) -
        separation[cell] * 1.2 +
        0.5 * random(`${seedPrefix}-origin-${group}-${cell}`);
      if (key < bestKey) {
        bestKey = key;
        origin = cell;
      }
    }
    if (origin < 0) {
      origin = Math.floor(random(`${seedPrefix}-origin-full-${group}`) * cellCount);
    }
    const centre = points[origin];

    // Cells nearest that opening, measured in pixels so the patch comes out
    // roughly round on screen rather than stretched along the wide cells, and
    // with enough noise on the key to keep its edge ragged.
    const nearest = points
      .map((p, cell) => ({
        cell,
        key:
          Math.hypot(p.x - centre.x, p.y - centre.y) / cellDiagonal +
          random(`${seedPrefix}-blob-${group}-${cell}`),
      }))
      .sort((a, b) => a.key - b.key)
      .map((k) => k.cell);

    // How much ground this burst covers. Early bursts pile several deep into
    // a small patch; by the end of the piece a burst spreads out completely.
    const spread = density[0] + (density[1] - density[0]) * outward;
    const blobSize = Math.max(1, Math.min(members.length, Math.round(members.length * spread)));

    const fresh = nearest.filter((cell) => !claimed[cell]);
    const reused = nearest.filter((cell) => claimed[cell]);
    const taken = [...fresh, ...reused].slice(0, blobSize);
    for (const cell of taken) {
      if (!claimed[cell]) {
        claimed[cell] = 1;
        claimedCells.push(cell);
      }
    }

    // Fill the patch in scattered order, not as an expanding ring — a burst
    // should read as arriving all at once. Cycling a shuffled list rather than
    // picking at random guarantees every cell in the patch is actually filled.
    const shuffled = taken
      .map((cell, k) => ({ cell, key: random(`${seedPrefix}-fill-${group}-${k}`) }))
      .sort((a, b) => a.key - b.key)
      .map((entry) => entry.cell);
    members.forEach((member, k) => {
      assignment[member] = shuffled[k % shuffled.length];
    });
  });

  return assignment;
};
// <<< layout:clustered

/** The layouts a variant can select. A single-variant bundle keeps only its
 *  own entry, and the other layout's implementation goes with it. */
const LAYOUTS: Record<string, LayoutFn> = {
  // >>> layout:radial — dropped from the dark-only bundle by scripts/package.mjs
  radial: radialCells,
  // <<< layout:radial
  // >>> layout:clustered — dropped from the light-only bundle by scripts/package.mjs
  clustered: clusteredCells,
  // <<< layout:clustered
};

export const buildDialogs = (variantName: VariantName): DialogInstance[] => {
  const variant = VARIANTS[variantName];
  const schedule = buildSchedule(variant.spawn);
  const count = schedule.length;
  const clustered = variant.layout === "clustered";

  // Let centres run past the frame edge so dialogs actually cover the corners.
  const halfW = WIDTH / 2 + variant.dialog.width * 0.34;
  const halfH = HEIGHT / 2 + variant.dialog.height * 0.62;
  const jitterRad = (variant.rotationJitterDeg * Math.PI) / 180;

  // A tilted dialog covers slightly less axis-aligned ground than a square-on
  // one. Size the grid off that reduced footprint, or the tilt opens hairline
  // seams between neighbours in the finished frame.
  const cos = Math.cos(jitterRad);
  const sin = Math.sin(jitterRad);
  const coveredW = variant.dialog.width * cos - variant.dialog.height * sin;
  const coveredH = variant.dialog.height * cos - variant.dialog.width * sin;

  const grid = buildGrid(clustered ? 0 : count, count, halfW, halfH, coveredW, coveredH);

  const cellCount = grid.cols * grid.rows;
  const points: Point[] = [];
  for (let cell = 0; cell < cellCount; cell++) {
    points.push(cellPosition(grid, cell, `${variantName}-cell-${cell}`));
  }

  const assignment = LAYOUTS[variant.layout]({
    grid,
    points,
    schedule,
    seedPrefix: variantName,
    halfW,
    halfH,
    density: variant.clusterDensity,
  });

  return schedule.map((entry, i) => {
    const seed = `${variantName}-dialog-${i}`;
    let point: Point;
    if (!clustered && i === 0) {
      // Alone, dead centre. The emptiness around it is the whole opening.
      point = { x: WIDTH / 2, y: HEIGHT / 2 };
    } else if (i < assignment.length && assignment[i] !== undefined) {
      const cell = assignment[i];
      // Dialogs past the first pass through a cell get their own jitter, so a
      // reclaimed cell is a near miss rather than an exact duplicate.
      point = clustered ? cellPosition(grid, cell, seed) : points[cell];
    } else {
      // More dialogs than cells: the overflow piles on anywhere, which is
      // exactly what the tail of the flood should look like.
      const cell = assignment[Math.floor(random(`${seed}-cell`) * assignment.length)] ?? 0;
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
