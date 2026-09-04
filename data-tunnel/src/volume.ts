// The point volume, generated once at module scope from a seeded PRNG.
//
// Recycling is an offset computed in the shader from the current frame, not
// a regeneration: nothing in here is ever recomputed, and nothing depends on
// the frame. Remotion renders frames out of order across threads, so all
// per-frame state has to be a pure function of useCurrentFrame().

import {
  ATT_BASE,
  ATT_REF,
  DASH_FRACTION,
  DZ,
  FILL_EXTENT_X,
  FILL_EXTENT_Y,
  FILL_SETS,
  JITTER,
  NX_FILL,
  NX_WALL,
  NY_FILL,
  NY_WALL,
  NZ,
  STREAK_COUNT,
  WALL_SHELLS,
  WALL_SHELL_INSET,
  X_HALF,
  Y_HALF,
  Z_TOTAL,
} from "./constants";
import { brightnessField, mulberry32 } from "./random";

// Shimmer cycles, in frames. Each divides DURATION_IN_FRAMES (450) exactly,
// so the flicker loops with the travel.
const SHIMMER_PERIODS = [90, 150, 225];
const SHIMMER_FRACTION = 0.2;
const SHIMMER_AMPLITUDE = 0.3;

export type DotBuffers = {
  readonly count: number;
  readonly position: Float32Array; // x, y, z0
  readonly size: Float32Array; // px at REFERENCE_HEIGHT
  readonly bright: Float32Array;
  readonly shimmer: Float32Array; // amplitude, phase
  readonly period: Float32Array; // frames
  readonly tint: Float32Array; // 0..1
};

export type CapsuleBuffers = {
  readonly count: number;
  readonly position: Float32Array; // x, y, z0
  readonly length: Float32Array; // world units along the travel axis
  readonly width: Float32Array; // px at REFERENCE_HEIGHT
  readonly bright: Float32Array;
  readonly shimmer: Float32Array;
  readonly period: Float32Array;
  readonly tint: Float32Array;
};

type RawElement = {
  x: number;
  y: number;
  z: number;
  size: number;
  bright: number;
  shimAmp: number;
  shimPhase: number;
  period: number;
  tint: number;
  dashLength: number; // 0 for dots
};

const rnd = mulberry32(20240917);

const jitter = (spacing: number) => (rnd() - 0.5) * 2 * JITTER * spacing;

const makeElement = (
  x: number,
  y: number,
  z: number,
  brightScale: number,
): RawElement => {
  // Low-frequency noise field drives brightness, so the camera passes
  // through denser glowing regions and darker stretches.
  const field = brightnessField(x, y, z);
  const bright = Math.min(
    1.4,
    (0.18 + 0.95 * Math.pow(field, 1.7)) * (0.55 + 0.9 * rnd()) * brightScale,
  );

  // 1-4px at 4K, i.e. 0.5-2px against the 1080-tall reference frame.
  const size = 0.6 + 1.5 * Math.pow(rnd(), 1.5);

  const shimmers = rnd() < SHIMMER_FRACTION;
  const isDash = rnd() < DASH_FRACTION;

  return {
    x,
    y,
    z,
    size,
    bright,
    shimAmp: shimmers ? SHIMMER_AMPLITUDE : 0,
    shimPhase: rnd(),
    period: SHIMMER_PERIODS[Math.floor(rnd() * SHIMMER_PERIODS.length)],
    tint: Math.pow(rnd(), 3),
    dashLength: isDash ? DZ * (0.25 + 0.55 * rnd()) : 0,
  };
};

const buildElements = (): RawElement[] => {
  const out: RawElement[] = [];

  const sx = (2 * X_HALF) / NX_WALL;
  const sy = (2 * Y_HALF) / NY_WALL;

  // --- Four walls -------------------------------------------------------
  // Denser planes of points at top, bottom, left and right. Each wall is a
  // regular (u, z) grid so it reads as a wall, with a half-cell stagger
  // between shells to avoid a picket-fence look.
  for (let shell = 0; shell < WALL_SHELLS; shell++) {
    const inset = shell * WALL_SHELL_INSET;
    const stagger = shell * 0.5;

    for (let iz = 0; iz < NZ; iz++) {
      const z = (iz + stagger) * DZ + jitter(DZ);

      for (let ix = 0; ix < NX_WALL; ix++) {
        const x = -X_HALF + (ix + 0.5 + stagger) * sx + jitter(sx);
        for (const sign of [1, -1]) {
          out.push(
            makeElement(x, sign * (Y_HALF - inset) + jitter(0.45), z, 1.15),
          );
        }
      }

      for (let iy = 0; iy < NY_WALL; iy++) {
        const y = -Y_HALF + (iy + 0.5 + stagger) * sy + jitter(sy);
        for (const sign of [1, -1]) {
          out.push(
            makeElement(sign * (X_HALF - inset) + jitter(0.45), y, z, 1.15),
          );
        }
      }
    }
  }

  // --- Interior scatter -------------------------------------------------
  // Sparser fill between the walls, held dimmer so the walls stay dominant.
  const fx = (2 * X_HALF * FILL_EXTENT_X) / NX_FILL;
  const fy = (2 * Y_HALF * FILL_EXTENT_Y) / NY_FILL;

  for (let set = 0; set < FILL_SETS; set++) {
    const stagger = set * 0.5;
    for (let iz = 0; iz < NZ; iz++) {
      const z = (iz + stagger + 0.25) * DZ + jitter(DZ);
      for (let ix = 0; ix < NX_FILL; ix++) {
        for (let iy = 0; iy < NY_FILL; iy++) {
          const x =
            -X_HALF * FILL_EXTENT_X + (ix + 0.5 + stagger) * fx + jitter(fx);
          const y =
            -Y_HALF * FILL_EXTENT_Y + (iy + 0.5 + stagger) * fy + jitter(fy);
          out.push(makeElement(x, y, z, 0.55));
        }
      }
    }
  }

  return out;
};

const ELEMENTS = buildElements();

const toDots = (src: RawElement[]): DotBuffers => {
  const count = src.length;
  const position = new Float32Array(count * 3);
  const size = new Float32Array(count);
  const bright = new Float32Array(count);
  const shimmer = new Float32Array(count * 2);
  const period = new Float32Array(count);
  const tint = new Float32Array(count);

  src.forEach((e, i) => {
    position[i * 3] = e.x;
    position[i * 3 + 1] = e.y;
    position[i * 3 + 2] = e.z;
    size[i] = e.size;
    bright[i] = e.bright;
    shimmer[i * 2] = e.shimAmp;
    shimmer[i * 2 + 1] = e.shimPhase;
    period[i] = e.period;
    tint[i] = e.tint;
  });

  return { count, position, size, bright, shimmer, period, tint };
};

const toCapsules = (src: RawElement[], widthGain: number): CapsuleBuffers => {
  const count = src.length;
  const position = new Float32Array(count * 3);
  const length = new Float32Array(count);
  const width = new Float32Array(count);
  const bright = new Float32Array(count);
  const shimmer = new Float32Array(count * 2);
  const period = new Float32Array(count);
  const tint = new Float32Array(count);

  src.forEach((e, i) => {
    position[i * 3] = e.x;
    position[i * 3 + 1] = e.y;
    position[i * 3 + 2] = e.z;
    length[i] = e.dashLength;
    width[i] = e.size * widthGain;
    bright[i] = e.bright;
    shimmer[i * 2] = e.shimAmp;
    shimmer[i * 2 + 1] = e.shimPhase;
    period[i] = e.period;
    tint[i] = e.tint;
  });

  return { count, position, length, width, bright, shimmer, period, tint };
};

export const DOTS = toDots(ELEMENTS.filter((e) => e.dashLength === 0));
export const DASHES = toCapsules(
  ELEMENTS.filter((e) => e.dashLength > 0),
  0.85,
);

// --- Bright streaks -------------------------------------------------------
// Much longer and much brighter than the dashes, spread evenly down the
// tunnel so only three or four are ever inside the near band at once. They
// are the elements that get bloomed.
const buildStreaks = (): CapsuleBuffers => {
  const srnd = mulberry32(90210);
  const src: RawElement[] = [];

  for (let i = 0; i < STREAK_COUNT; i++) {
    const z = ((i + 0.5 + (srnd() - 0.5) * 0.6) / STREAK_COUNT) * Z_TOTAL;

    // Most of them ride near a wall, where the reference's streaks sit; the
    // rest cut through the interior.
    let x: number;
    let y: number;
    if (srnd() < 0.72) {
      if (srnd() < 0.55) {
        x = (srnd() * 2 - 1) * X_HALF * 0.95;
        y = (srnd() < 0.5 ? 1 : -1) * (Y_HALF - srnd() * 2.2);
      } else {
        x = (srnd() < 0.5 ? 1 : -1) * (X_HALF - srnd() * 2.2);
        y = (srnd() * 2 - 1) * Y_HALF * 0.95;
      }
    } else {
      x = (srnd() * 2 - 1) * X_HALF * 0.7;
      y = (srnd() * 2 - 1) * Y_HALF * 0.7;
    }

    src.push({
      x,
      y,
      z,
      size: 1.5 + srnd() * 1.5,
      bright: 0.7 + srnd() * 0.45,
      shimAmp: 0.12,
      shimPhase: srnd(),
      period: SHIMMER_PERIODS[Math.floor(srnd() * SHIMMER_PERIODS.length)],
      tint: Math.pow(srnd(), 2),
      dashLength: 3.5 + srnd() * 6,
    });
  }

  return toCapsules(src, 1);
};

export const STREAKS = buildStreaks();

export const TOTAL_ELEMENTS = DOTS.count + DASHES.count + STREAKS.count;

/** Apparent-size attenuation, mirrored in the shaders. */
export const attenuation = (distance: number): number =>
  ATT_REF / Math.max(distance, 0.5) + ATT_BASE;
