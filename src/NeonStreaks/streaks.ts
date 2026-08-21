import { config } from "./config";
import { biased, mulberry32, range } from "../lib/random";

/**
 * Immutable, resolution-independent description of one streak.
 * Built once at module scope from a seeded PRNG, so every render worker and
 * every frame agrees. `xNorm` and `phase` are normalised; they are scaled to
 * the actual frame and frame number at draw time.
 */
export type Streak = {
  index: number;
  /** Lateral position of the bend, stratified over a band that skips the centre. */
  xNorm: number;
  /** Floor-run yaw in radians, signed outward. */
  yaw: number;
  /** Depth at which this streak turns upward. */
  bendDepth: number;
  /** How much depth the floor run covers before the bend. */
  runDepth: number;
  /** Quarter-circle radius of the 90 degree bend. */
  bendRadius: number;
  /** Trail length along the path, world units. */
  trailLength: number;
  /** Core thickness in world units. */
  coreWidth: number;
  /** Whole traversals per loop — an integer, which is what closes the loop. */
  cycles: number;
  /** Starting phase in [0, 1). */
  phase: number;
  /** Per-streak brightness. */
  intensity: number;
};

/**
 * Coprime with `count`, used to scatter the stratified lateral slots across the
 * index order. The density envelope gates by index, so this keeps a thinned-out
 * frame evenly spread instead of removing one contiguous band.
 */
const STRATUM_STRIDE = 27;

const buildStreaks = (): readonly Streak[] => {
  const rng = mulberry32(config.seed);
  const s = config.streaks;
  const out: Streak[] = [];

  for (let i = 0; i < s.count; i++) {
    // depthT: 0 = bends closest to camera, 1 = bends furthest away.
    const depthT = rng();
    const bendDepth =
      config.bend.depth.near +
      depthT * (config.bend.depth.far - config.bend.depth.near);
    const runDepth = range(rng, s.runDepth.min, s.runDepth.max);

    // Far streaks get the low cycle counts, so they also read as slower.
    const speedIdx = Math.min(
      s.cyclesPerLoop.length - 1,
      Math.floor((1 - depthT) * s.cyclesPerLoop.length),
    );

    // Stratify over the left and right bands separately, so thinning the
    // frame never empties one side.
    const stratum = (i * STRATUM_STRIDE) % s.count;
    const half = s.count / 2;
    const side = stratum < half ? -1 : 1;
    const slot = ((stratum % half) + rng()) / half;
    const { inner, outer } = s.lateralBand;
    const xNorm = side * (inner + slot * (outer - inner));

    // Yaw sweeps outward, away from the frame centre.
    const yaw =
      side * ((range(rng, s.yawDeg.min, s.yawDeg.max) * Math.PI) / 180);

    out.push({
      index: i,
      xNorm,
      yaw,
      bendDepth,
      runDepth,
      bendRadius: range(rng, config.bend.radius.min, config.bend.radius.max),
      // Bias toward shorter trails so a few long ribbons stand out.
      trailLength: biased(rng, s.trailLength.min, s.trailLength.max, 1.7),
      coreWidth: biased(rng, s.coreWidth.min, s.coreWidth.max, 1.5),
      cycles: s.cyclesPerLoop[speedIdx],
      phase: rng(),
      intensity: range(rng, s.intensity.min, s.intensity.max),
    });
  }

  return Object.freeze(out);
};

/** Generated once, at module load. Do not mutate. */
export const STREAKS = buildStreaks();

const TAU = Math.PI * 2;

/**
 * Fraction of streaks visible at this frame. One cosine cycle over the loop:
 * sparse at frame 0, dense at the midpoint, sparse again at the end — and
 * exactly periodic, so the loop point still matches.
 */
export const densityAt = (frame: number, durationInFrames: number): number => {
  const { min, max } = config.density;
  const wave = 0.5 - 0.5 * Math.cos((TAU * frame) / durationInFrames);
  return min + (max - min) * wave;
};

/**
 * Visibility of one streak under the density envelope, feathered so streaks
 * fade in and out instead of popping.
 */
export const gateFor = (
  streak: Streak,
  frame: number,
  durationInFrames: number,
): number => {
  const active = densityAt(frame, durationInFrames) * config.streaks.count;
  const t = (active - streak.index) / config.density.featherIndices;
  return t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t);
};

/** Phase of a streak at a frame. Integer `cycles` is what makes it loop. */
export const phaseAt = (
  streak: Streak,
  frame: number,
  durationInFrames: number,
): number => {
  const p = streak.phase + (streak.cycles * frame) / durationInFrames;
  return p - Math.floor(p);
};
