/**
 * Fixed numbers for the arrow field. Everything spatial is expressed in 4K
 * composition pixels; nothing here depends on the render `--scale`.
 */

export const WIDTH = 3840;
export const HEIGHT = 2160;
export const FPS = 30;

/**
 * The loop length. Every periodic quantity in the field is a function of
 * `frame % LOOP_FRAMES`, and every period divides LOOP_FRAMES, so frame 0 and
 * frame 330 are pixel-identical by construction.
 */
export const LOOP_FRAMES = 330;

export const ARROW_COUNT = 55;
export const SHARD_COUNT = 90;
export const SPARK_COUNT = 70;

/** Depth range. z = 0.2 is the far plane, z = 1.0 the near plane. */
export const Z_MIN = 0.2;
export const Z_MAX = 1.0;

/**
 * Depth buckets. Blur is applied once per bucket to a whole offscreen buffer,
 * never per element. The mid band is sharp; both extremes are soft, which is
 * what a real lens does either side of its focal plane.
 */
export const DEPTH_BANDS = [
  { name: "far", zMax: 0.45, blur: 22 },
  { name: "mid", zMax: 0.78, blur: 0 },
  { name: "near", zMax: Infinity, blur: 13 },
] as const;

export type BandIndex = 0 | 1 | 2;

export const bandForDepth = (z: number): BandIndex =>
  (z < DEPTH_BANDS[0].zMax ? 0 : z < DEPTH_BANDS[1].zMax ? 1 : 2) as BandIndex;

/** Opacity ramp across depth: 20% at the far plane, 70% at the near plane. */
export const OPACITY_FAR = 0.2;
export const OPACITY_NEAR = 0.7;

/**
 * Scale ramp across depth, before per-element jitter. Together with
 * SIZE_JITTER this gives roughly a 1:6 spread between the smallest and
 * largest element in the field.
 */
export const SCALE_FAR = 0.4;
export const SCALE_NEAR = 1.75;
export const SIZE_JITTER = { min: 0.85, max: 1.15 };
export const MAX_SIZE_MUL = SCALE_NEAR * SIZE_JITTER.max;

/** Drift speed targets along the shared axis, in 4K px per frame. */
export const SPEED_FAR = 9;
export const SPEED_NEAR = 32;

/** Static per-element tilt off the shared axis. */
export const ARROW_TILT_DEG = 12;
export const SHARD_TILT_DEG = 25;

/** Slow seeded wobble layered on top of the static tilt. */
export const WOBBLE_DEG = 3;
/** Periods (in whole cycles per loop) available to wobble and breathe. */
export const CYCLE_CHOICES = [1, 2, 3, 5] as const;

/** Baked-in sprite alphas. Overlaps brighten because these stay well under 1. */
export const ARROW_FILL_ALPHA = 0.3;
export const ARROW_EDGE_ALPHA = 0.9;
export const SHARD_FILL_ALPHA = 0.22;
export const SHARD_EDGE_ALPHA = 0.8;

/** Base geometry of the arrow, in 4K px at sizeMul = 1. */
export const ARROW_LENGTH = 420;
export const ARROW_WIDTH = 200;
export const ARROW_HEAD_WIDTH = 300;
export const ARROW_HEAD_LENGTH = 168;
export const ARROW_STROKE = 7;
/** Outline-only arrows (v2) read lighter, so they are drawn bigger. */
export const OUTLINE_ARROW_SIZE_BOOST = 1.45;

export const SHARD_STROKE = 6;

/** Ambient camera drift: a closed circular path, ±8 px, one turn per loop. */
export const CAMERA_DRIFT_PX = 8;

/** Background mottling is computed at 1/8 resolution and upscaled. */
export const MOTTLE_DIVISOR = 8;
/** Grain is computed at 1/3 resolution and upscaled. */
export const GRAIN_DIVISOR = 3;
export const GRAIN_ALPHA = 0.04;
/** Bloom is gathered from a 1/4-resolution copy of the field. */
export const BLOOM_DIVISOR = 4;

export const VIGNETTE_STRENGTH = 0.2;
