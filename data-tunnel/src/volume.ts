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
  NY_FILL,
  NZ,
  WALL_SHELLS,
  WALL_SPACING_X,
  WALL_SPACING_Y,
  X_HALF,
  Y_HALF,
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

  // --- Walls ------------------------------------------------------------
  // Nested rectangular shells: two dense inner ones that read as the walls
  // of the corridor, then a coarser, dimmer mantle spreading outward so the
  // field carries all the way past the frame edges.
  WALL_SHELLS.forEach((shell, si) => {
    const halfX = X_HALF + shell.offset;
    const halfY = Y_HALF + shell.offset;
    const nx = Math.max(6, Math.round((2 * halfX) / (WALL_SPACING_X * shell.step)));
    const ny = Math.max(6, Math.round((2 * halfY) / (WALL_SPACING_Y * shell.step)));
    const sx = (2 * halfX) / nx;
    const sy = (2 * halfY) / ny;
    const stagger = (si % 2) * 0.5;
    // Outer shells are given more spread along their normal so they read as
    // thickness rather than as a hard concentric outline.
    const spread = 1.6 * shell.step;

    for (let iz = 0; iz < NZ; iz++) {
      const z = (iz + stagger) * DZ + jitter(DZ);

      for (let ix = 0; ix < nx; ix++) {
        const x = -halfX + (ix + 0.5 + stagger) * sx + jitter(sx);
        for (const sign of [1, -1]) {
          out.push(
            makeElement(x, sign * halfY + jitter(spread), z, shell.bright),
          );
        }
      }

      for (let iy = 0; iy < ny; iy++) {
        const y = -halfY + (iy + 0.5 + stagger) * sy + jitter(sy);
        for (const sign of [1, -1]) {
          out.push(
            makeElement(sign * halfX + jitter(spread), y, z, shell.bright),
          );
        }
      }
    }
  });

  // --- Interior scatter -------------------------------------------------
  // Sparser fill between the walls, held dimmer so the walls stay dominant.
  // These are also what sweeps closest to the camera, so they supply most of
  // the big out-of-focus blobs near the frame edges.
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
          out.push(makeElement(x, y, z, 0.42));
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

export const TOTAL_ELEMENTS = DOTS.count + DASHES.count;

/** Apparent-size attenuation, mirrored in the shaders. */
export const attenuation = (distance: number): number =>
  ATT_REF / Math.max(distance, 0.5) + ATT_BASE;
