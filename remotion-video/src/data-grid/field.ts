import {
  BLOCK_COUNT,
  DURATION_IN_FRAMES,
  DASH_COUNT,
  FIELD_HALF_X,
  FIELD_HALF_Y,
  GRID_HORIZONTALS,
  GRID_VERTICALS,
  NODE_COUNT,
  READOUT_COUNT,
  READOUT_VALUES,
} from "./constants";
import { rngFor } from "./random";

/**
 * Shared placement: a position in base pixels at the bottom of the zoom
 * band, plus the element's starting phase within that band.
 */
type Placed = { bx: number; by: number; seed: number };

const place = (index: number, salt: number): Placed => {
  const r = rngFor(index, salt);
  return {
    bx: (r() * 2 - 1) * FIELD_HALF_X,
    by: (r() * 2 - 1) * FIELD_HALF_Y,
    seed: r(),
  };
};

export type Node = Placed & {
  /** Diameter in base pixels at zoom 1. */
  size: number;
  /** 0 dim, 1 mid, 2 hot (white, with a halo). */
  tier: 0 | 1 | 2;
  phase: number;
  twinkle: number;
};

export type Readout = Placed & {
  /** Type size in base pixels at zoom 1. */
  size: number;
  tier: 0 | 1 | 2;
  /** Index into READOUT_VALUES; stepped over time when `cycle` > 0. */
  valueIndex: number;
  /**
   * Frames between value changes, 0 for a value that never changes.
   * Always a divisor of DURATION_IN_FRAMES so the sequence of values
   * comes back around exactly on the loop seam.
   */
  cycle: number;
  phase: number;
};

export type Dash = Placed & {
  length: number;
  thickness: number;
  hot: boolean;
  phase: number;
  blink: number;
};

/** A short run of dashes stacked like a barcode. */
export type Block = Placed & {
  bars: { dx: number; dy: number; length: number }[];
  thickness: number;
  phase: number;
};

const buildNodes = (): Node[] =>
  Array.from({ length: NODE_COUNT }, (_, i) => {
    const p = place(i, 11);
    const r = rngFor(i, 12);
    const roll = r();
    const tier = roll > 0.84 ? 2 : roll > 0.5 ? 1 : 0;
    return {
      ...p,
      size: 1.8 + r() * (tier === 2 ? 4.2 : 2.2),
      tier: tier as 0 | 1 | 2,
      phase: r() * Math.PI * 2,
      twinkle: 0.1 + r() * 0.35,
    };
  });

/** Divisors of DURATION_IN_FRAMES (600) in a plausible flicker range. */
const VALUE_CYCLES = [15, 20, 24, 25, 30, 40, 50, 60];

const buildReadouts = (): Readout[] =>
  Array.from({ length: READOUT_COUNT }, (_, i) => {
    const p = place(i, 21);
    const r = rngFor(i, 22);
    const roll = r();
    const tier = roll > 0.93 ? 2 : roll > 0.64 ? 1 : 0;
    // A wide size spread: with the zoom band this narrow, the mix of
    // big headline values and tiny background ones comes from here.
    const t = r();
    return {
      ...p,
      size: tier === 2 ? 20 + t * 13 : tier === 1 ? 11 + t * 7 : 7 + t * 4,
      tier: tier as 0 | 1 | 2,
      valueIndex: Math.floor(r() * READOUT_VALUES.length),
      cycle: r() > 0.5 ? 0 : VALUE_CYCLES[Math.floor(r() * VALUE_CYCLES.length)],
      phase: r() * Math.PI * 2,
    };
  });

const buildDashes = (): Dash[] =>
  Array.from({ length: DASH_COUNT }, (_, i) => {
    const p = place(i, 31);
    const r = rngFor(i, 32);
    return {
      ...p,
      length: 10 + r() * 34,
      thickness: 1.8 + r() * 2.4,
      hot: r() > 0.8,
      phase: r() * Math.PI * 2,
      blink: r() > 0.68 ? 0.5 : 0,
    };
  });

const buildBlocks = (): Block[] =>
  Array.from({ length: BLOCK_COUNT }, (_, i) => {
    const p = place(i, 41);
    const r = rngFor(i, 42);
    const barCount = 3 + Math.floor(r() * 3);
    return {
      ...p,
      thickness: 2.2 + r() * 1.8,
      phase: r() * Math.PI * 2,
      bars: Array.from({ length: barCount }, (_, b) => ({
        dx: b * (17 + r() * 11),
        dy: (r() * 2 - 1) * 7,
        length: 8 + r() * 17,
      })),
    };
  });

export type GridLine = {
  /** Offset from frame centre in base pixels, at zoom 1. */
  offset: number;
  seed: number;
  hot: boolean;
  alpha: number;
};

/**
 * Grid lines are spread evenly across the field and then jittered: the
 * reference's spacing is irregular, not a regular lattice. Each line
 * carries its own band phase so lines recycle independently rather than
 * all sweeping outward in lockstep.
 */
const buildLines = (count: number, halfExtent: number, salt: number) =>
  Array.from({ length: count }, (_, i): GridLine => {
    const r = rngFor(i, salt);
    const even = (i / (count - 1)) * 2 - 1;
    const jitter = (r() * 2 - 1) * (halfExtent / count) * 1.15;
    return {
      offset: even * halfExtent + jitter,
      seed: r(),
      hot: r() > 0.82,
      alpha: 0.55 + r() * 0.45,
    };
  });

// Built once at module load: the field's identity never changes, only
// the camera moves through it.
export const NODES = buildNodes();
export const READOUTS = buildReadouts();
export const DASHES = buildDashes();
export const BLOCKS = buildBlocks();
export const GRID = {
  vertical: buildLines(GRID_VERTICALS, FIELD_HALF_X, 51),
  horizontal: buildLines(GRID_HORIZONTALS, FIELD_HALF_Y, 52),
};

export const readoutText = (readout: Readout, frame: number) => {
  if (readout.cycle === 0) return READOUT_VALUES[readout.valueIndex];
  // Wrap the step count at one clip's worth of changes: frame 600 then
  // shows exactly what frame 0 does, keeping the loop seamless.
  const stepsPerLoop = DURATION_IN_FRAMES / readout.cycle;
  const step = Math.floor(frame / readout.cycle) % stepsPerLoop;
  return READOUT_VALUES[(readout.valueIndex + step) % READOUT_VALUES.length];
};
