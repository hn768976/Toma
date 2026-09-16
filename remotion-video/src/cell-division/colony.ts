// Deterministic binary-fission model.
//
// The whole colony is precomputed once from a seed into a flat list of
// cells. Nothing here reads Math.random(), Date.now() or a previous
// frame's state: a cell's position at time t is a closed-form function of
// its own record and t. Remotion renders frames out of order across
// worker tabs, so anything that carried between frames would show up as
// popping.

import { DURATION_IN_SECONDS } from "./constants";
import { mulberry32 } from "./random";

export type Cell = {
  gen: number;
  /** Seconds at which this cell appears -- its parent's division moment. */
  birth: number;
  /** Seconds at which it splits in two. Infinity if it never does. */
  divide: number;
  /** Position at birth, in un-expanded colony space (see expansion()). */
  ox: number;
  oy: number;
  oz: number;
  /** Unit vector the cell travels along as it pulls away from its sibling. */
  ax: number;
  ay: number;
  az: number;
  /** How far it travels along that axis. */
  sep: number;
  /** Final radius. */
  radius: number;
  /** Radius at the moment of birth -- its parent's radius, see below. */
  birthRadius: number;
  /** Per-cell noise offset, so no two cells share a fuzz pattern. */
  seed: number;
  /** Gentle idle wobble, so the colony never looks frozen between splits. */
  wobPhase: number;
  wobAmp: number;
};

/** Seconds between a cell's birth and its own division, before jitter. */
const DIVISION_PERIOD = 1.5;
/** Fraction of DIVISION_PERIOD that division timing is randomised by. */
const DIVISION_JITTER = 0.42;
/** Seconds a pair takes to pull fully apart. */
export const SEPARATION_DURATION = 0.78;
/** Seconds a newborn cell takes to settle to its own radius. */
export const GROWTH_DURATION = 0.7;
/** Centre-to-centre distance of a finished split, in radii. */
const SEPARATION_RADII = 2.3;

/** The colony swells outward over time; this is the per-second rate. */
export const EXPANSION_RATE = 0.055;

/**
 * Total nodes in the tree. Once it is spent, the remaining cells simply
 * stop dividing -- which also reads correctly, as some of the colony
 * going quiescent while the rest carries on. It is what holds the final
 * seconds at "packed" rather than letting them saturate into a flat wall
 * of overlapping grey with no backdrop showing through.
 */
const MAX_CELLS = 360;

/** The root is already full-grown and drifting when the video opens. */
const ROOT_BIRTH = -2;
/** First split lands early enough that two cells are clearly apart by 1s. */
const ROOT_DIVIDE = 0.3;

const BASE_RADIUS = 1;
/** Cells shrink very slightly each generation, as real dividing cells do. */
const RADIUS_DECAY = 0.968;
const RADIUS_VARIANCE = 0.19;

const normalize = (x: number, y: number, z: number) => {
  const len = Math.hypot(x, y, z) || 1;
  return [x / len, y / len, z / len] as const;
};

/**
 * Picks the axis a cell splits along. Biased towards the screen plane so
 * most splits read as two cells separating rather than one cell hiding
 * behind another -- but not so biased that the colony flattens to a disc.
 */
const splitAxis = (rand: () => number) => {
  const theta = rand() * Math.PI * 2;
  const cosPhi = (rand() * 2 - 1) * 0.55;
  const sinPhi = Math.sqrt(1 - cosPhi * cosPhi);
  // The z term is damped hard. Each generation's walk compounds, so an
  // unbiased axis builds a deep ball that the camera then stares straight
  // into -- every sight line hits several cells and the backdrop never
  // shows through. Damping it keeps the colony closer to a thick slab,
  // which still reads as fully three-dimensional under the defocus but
  // leaves gaps to see past.
  return normalize(
    Math.cos(theta) * sinPhi,
    Math.sin(theta) * sinPhi,
    cosPhi * 0.5,
  );
};

export const buildColony = (seed: number): Cell[] => {
  const rand = mulberry32(seed);
  const cells: Cell[] = [];

  cells.push({
    gen: 0,
    birth: ROOT_BIRTH,
    divide: ROOT_DIVIDE,
    ox: 0,
    oy: 0,
    oz: 0,
    ax: 0,
    ay: 1,
    az: 0,
    sep: 0,
    radius: BASE_RADIUS,
    birthRadius: BASE_RADIUS,
    seed: rand() * 100,
    wobPhase: rand() * Math.PI * 2,
    wobAmp: 0.05,
  });

  // Breadth-first, so generations come out in order and the sweep stops
  // cleanly once nothing divides before the end of the video.
  for (let i = 0; i < cells.length; i++) {
    const parent = cells[i];
    if (!Number.isFinite(parent.divide)) continue;
    if (parent.divide > DURATION_IN_SECONDS) continue;
    if (cells.length + 2 > MAX_CELLS) {
      // Out of budget. The cell has to stop dividing rather than divide
      // into nothing -- otherwise it disappears at its division moment
      // with no daughters to replace it, and the colony depopulates
      // exactly when it should be at its most crowded.
      parent.divide = Infinity;
      continue;
    }

    // Both daughters start exactly where the parent stood, at exactly the
    // parent's radius. At the division instant they are two coincident
    // spheres the size of the parent, so the split has no pop -- the
    // peanut shape emerges purely from them pulling apart.
    const [px, py, pz] = localPosition(parent, parent.divide);
    const parentRadius = cellRadius(parent, parent.divide);
    const [ax, ay, az] = splitAxis(rand);
    const childRadius =
      parent.radius * RADIUS_DECAY * (1 + (rand() * 2 - 1) * RADIUS_VARIANCE);

    for (const side of [1, -1]) {
      // Daughters get slightly different division clocks, which is what
      // turns a lock-step doubling into an organic-looking spread.
      const jitter = 1 + (rand() * 2 - 1) * DIVISION_JITTER;
      const divide = parent.divide + DIVISION_PERIOD * jitter;
      cells.push({
        gen: parent.gen + 1,
        birth: parent.divide,
        divide: divide > DURATION_IN_SECONDS ? Infinity : divide,
        ox: px,
        oy: py,
        oz: pz,
        ax: ax * side,
        ay: ay * side,
        az: az * side,
        sep: (SEPARATION_RADII / 2) * childRadius * (0.88 + rand() * 0.34),
        radius: childRadius,
        birthRadius: parentRadius,
        seed: rand() * 100,
        wobPhase: rand() * Math.PI * 2,
        wobAmp: 0.035 + rand() * 0.05,
      });
    }
  }

  return cells;
};

const easeOutCubic = (u: number) => 1 - Math.pow(1 - u, 3);

/** Uniform outward swell of the whole colony. */
export const expansion = (t: number) => Math.exp(EXPANSION_RATE * Math.max(0, t));

/**
 * Position in un-expanded colony space. The tree is built in this space so
 * that a daughter's stored origin is not double-counted by the swell.
 */
const localPosition = (cell: Cell, t: number): [number, number, number] => {
  const age = t - cell.birth;
  const push =
    cell.sep * easeOutCubic(Math.max(0, Math.min(1, age / SEPARATION_DURATION)));

  const w = cell.wobPhase + t * 0.85;
  return [
    cell.ox + cell.ax * push + Math.sin(w) * cell.wobAmp,
    cell.oy + cell.ay * push + Math.sin(w * 1.31 + 1.7) * cell.wobAmp,
    cell.oz + cell.az * push + Math.sin(w * 0.77 + 3.1) * cell.wobAmp,
  ];
};

/** World position of a cell at time t, in seconds. */
export const cellPosition = (
  cell: Cell,
  t: number,
  out: [number, number, number],
): [number, number, number] => {
  const [x, y, z] = localPosition(cell, t);
  const g = expansion(t);
  out[0] = x * g;
  out[1] = y * g;
  out[2] = z * g;
  return out;
};

/** Radius of a cell at time t, covering the settle-after-birth ramp. */
export const cellRadius = (cell: Cell, t: number) => {
  const u = Math.max(0, Math.min(1, (t - cell.birth) / GROWTH_DURATION));
  return cell.birthRadius + (cell.radius - cell.birthRadius) * easeOutCubic(u);
};

export const isAlive = (cell: Cell, t: number) =>
  t >= cell.birth && t < cell.divide;

export const MAX_CELL_COUNT = MAX_CELLS;
