import {
  BLOCK_COUNT,
  DASH_COUNT,
  DURATION_IN_FRAMES,
  FIELD_HALF_X,
  FIELD_HALF_Y,
  NODE_COUNT,
  READOUT_COUNT,
  READOUT_VALUES,
  Z_DEPTH,
} from "./constants";
import { rngFor } from "./random";

/**
 * Shared placement: a position in the world volume. Depth is uniform
 * across the slab, which is what a real fly-through looks like — most
 * elements read as distant, a few sweep past close.
 */
type Placed = { wx: number; wy: number; wz: number };

const place = (index: number, salt: number): Placed => {
  const r = rngFor(index, salt);
  return {
    wx: (r() * 2 - 1) * FIELD_HALF_X,
    wy: (r() * 2 - 1) * FIELD_HALF_Y,
    wz: r() * Z_DEPTH,
  };
};

export type Node = Placed & {
  /** Diameter in world units; multiplied by the perspective scale. */
  size: number;
  /** 0 dim, 1 mid, 2 hot (white, with a halo). */
  tier: 0 | 1 | 2;
  phase: number;
  twinkle: number;
};

export type Readout = Placed & {
  /** Type size in world units. */
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
      size: 2 + r() * (tier === 2 ? 4.5 : 2.5),
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
    // Depth supplies most of the size variation now, so the seeded
    // spread is narrower than it would be for a flat field.
    const t = r();
    return {
      ...p,
      size: tier === 2 ? 17 + t * 9 : tier === 1 ? 12 + t * 5 : 9 + t * 3,
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

// Built once at module load: the field's identity never changes, only
// the camera moves through it.
export const NODES = buildNodes();
export const READOUTS = buildReadouts();
export const DASHES = buildDashes();
export const BLOCKS = buildBlocks();

export const readoutText = (readout: Readout, frame: number) => {
  if (readout.cycle === 0) return READOUT_VALUES[readout.valueIndex];
  // Wrap the step count at one clip's worth of changes: frame 600 then
  // shows exactly what frame 0 does, keeping the loop seamless.
  const stepsPerLoop = DURATION_IN_FRAMES / readout.cycle;
  const step = Math.floor(frame / readout.cycle) % stepsPerLoop;
  return READOUT_VALUES[(readout.valueIndex + step) % READOUT_VALUES.length];
};
