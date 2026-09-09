/**
 * The ember field.
 *
 * Particles are generated once at module scope from a seeded PRNG and are
 * then *immutable*. Everything about an ember at a given moment — position,
 * heat, brightness, streak orientation — is derived from the frame number, so
 * frames can be rendered in any order and the field is guaranteed to loop.
 */

import { curlNoise } from "./noise";
import {
  HEAT_BUCKETS,
  heatBucket,
  type Palette,
} from "./palette";
import { mulberry32, range, rangeBiased } from "./random";

export type EmberClass = 0 | 1 | 2;
export const ORB: EmberClass = 0;
export const PINPOINT: EmberClass = 1;
export const STREAK: EmberClass = 2;

/** Depth buckets, used to batch draw calls. */
export const DEPTH_BUCKETS = 6;

/** Cycle lengths, in frames. Every one divides 450 exactly. */
const CYCLES = [150, 225, 450] as const;

/**
 * How far above and below the frame an ember's path extends, as a fraction of
 * frame height. Wide enough that embers enter and leave off-screen.
 */
const MARGIN = 0.12;

export type EmberSpec = {
  readonly cls: EmberClass;
  /** 0 = near camera, 1 = far. Drives size, blur, brightness and speed. */
  readonly depth: number;
  readonly depthBucket: number;
  /** Seed position across the frame, in fractions of width. */
  readonly x0: number;
  readonly cycle: number;
  readonly offset: number;
  /** Path length as a multiple of the full top-to-bottom span. */
  readonly distScale: number;

  readonly heat0: number;
  readonly coolRate: number;
  readonly heatBucket0: number;

  readonly turbAmp: number;
  readonly turbSeed: number;
  readonly swayAmp: number;
  readonly swayFreq: number;
  readonly swayPhase: number;

  readonly flickAmpA: number;
  readonly flickFreqA: number;
  readonly flickPhaseA: number;
  readonly flickAmpB: number;
  readonly flickFreqB: number;
  readonly flickPhaseB: number;

  /** 0 for embers that never wink out. */
  readonly winkWidth: number;
  readonly winkCenter: number;

  /** Core size, in fractions of frame height. */
  readonly size: number;
  /** Bloom halo radius as a multiple of `size` (pinpoints only). */
  readonly bloomScale: number;
  /** Length-to-width ratio (streaks only). */
  readonly stretch: number;
  /** Softness bucket for sprite selection, 0 = crispest. */
  readonly softness: number;
  readonly brightness: number;
};

export type EmberConfig = {
  readonly count: number;
  readonly palette: Palette;
  /** Multiplies every ember's path length — V3's "roaring fire" drift. */
  readonly riseBoost: number;
  readonly hazeIntensity: number;
  readonly seed: number;
};

/** Class mix: 60% pinpoints, 25% streaks, 15% orbs. */
const pickClass = (r: number): EmberClass =>
  r < 0.63 ? PINPOINT : r < 0.87 ? STREAK : ORB;

/**
 * Brightness by depth: mid-depth embers are brightest, near ones are dim and
 * transparent, far ones fade into the haze.
 */
const depthBrightness = (depth: number): number => {
  const d = (depth - 0.52) / 0.4;
  return 0.18 + 0.82 * Math.exp(-d * d);
};

/**
 * Softness by depth: near embers are heavily defocused, there is a sharp band
 * through the middle, and far embers go slightly soft again.
 */
const depthSoftness = (depth: number): number => {
  const near = Math.max(0, (0.34 - depth) / 0.34);
  const far = Math.max(0, (depth - 0.82) / 0.18);
  return Math.min(1, near * 1.15 + far * 0.34);
};

export const SOFTNESS_LEVELS = 4;

const buildEmber = (rnd: () => number, cfg: EmberConfig): EmberSpec => {
  const cls = pickClass(rnd());

  // Class and depth are correlated, as they are in the reference: the big
  // defocused orbs are the near-camera embers, streaks live in the mid band.
  const depth =
    cls === ORB
      ? rangeBiased(rnd, 0.0, 0.24, 0.85)
      : cls === STREAK
        ? range(rnd, 0.26, 0.74)
        : rangeBiased(rnd, 0.2, 1.0, 0.8);

  // Near embers cover more ground per second than far ones. That parallax is
  // what sells depth without a camera.
  const cycleBias = Math.min(0.999, depth * 0.85 + rnd() * 0.4);
  const cycle = CYCLES[Math.min(CYCLES.length - 1, Math.floor(cycleBias * CYCLES.length))];

  // The big defocused orbs sit in the orange band rather than the white-hot
  // one: a near-camera ember reading as a pale disc looks like dust, not fire.
  const heat0 = cls === ORB ? range(rnd, 0.42, 0.78) : range(rnd, 0.6, 1.0);
  const brightnessJitter = range(rnd, 0.7, 1.25);
  const classBrightness = cls === ORB ? 0.34 : cls === STREAK ? 0.9 : 1.0;

  const size =
    cls === ORB
      ? range(rnd, 0.018, 0.05) * (1 - depth * 1.4)
      : cls === STREAK
        ? range(rnd, 0.0030, 0.0048) * (1.3 - depth * 0.6)
        : rangeBiased(rnd, 0.0014, 0.0042, 1.8) * (1.45 - depth * 0.75);

  return {
    cls,
    depth,
    depthBucket: Math.min(DEPTH_BUCKETS - 1, Math.floor(depth * DEPTH_BUCKETS)),
    x0: range(rnd, -0.08, 1.08),
    cycle,
    offset: Math.floor(rnd() * cycle),
    distScale: range(rnd, 0.95, 1.5) * cfg.riseBoost,

    heat0,
    coolRate: range(rnd, 0.2, 0.65),
    heatBucket0: heatBucket(heat0),

    // Near embers are displaced more by the same field — closer to the eye.
    turbAmp: range(rnd, 0.6, 1.4) * (0.013 - depth * 0.0072),
    turbSeed: Math.floor(rnd() * 4) * 0x1f3d,
    swayAmp: range(rnd, 0.0012, 0.0055) * (1.2 - depth * 0.7),
    swayFreq: 2 + Math.floor(rnd() * 4),
    swayPhase: rnd(),

    flickAmpA: range(rnd, 0.1, 0.42),
    flickFreqA: 8 + Math.floor(rnd() * 19),
    flickPhaseA: rnd(),
    flickAmpB: range(rnd, 0.05, 0.24),
    flickFreqB: 3 + Math.floor(rnd() * 9),
    flickPhaseB: rnd(),

    winkWidth: rnd() < 0.14 ? range(rnd, 0.05, 0.16) : 0,
    winkCenter: rnd(),

    size: Math.max(0.00045, size),
    bloomScale: range(rnd, 5.0, 11.0),
    stretch: range(rnd, 1.4, 2.5),
    softness: Math.min(
      SOFTNESS_LEVELS - 1,
      Math.floor(depthSoftness(depth) * SOFTNESS_LEVELS),
    ),
    brightness: depthBrightness(depth) * classBrightness * brightnessJitter,
  };
};

export const buildField = (cfg: EmberConfig): EmberSpec[] => {
  const rnd = mulberry32(cfg.seed);
  const embers: EmberSpec[] = [];
  for (let i = 0; i < cfg.count; i++) embers.push(buildEmber(rnd, cfg));

  // Batch by depth, then by colour within each depth, so the draw loop walks
  // the sprite cache in long runs instead of thrashing it.
  embers.sort(
    (a, b) =>
      a.cls - b.cls ||
      a.depthBucket - b.depthBucket ||
      a.softness - b.softness ||
      a.heatBucket0 - b.heatBucket0,
  );
  return embers;
};

const TAU = Math.PI * 2;

/** Smooth 0→1 ramp. */
const smoothstep = (edge0: number, edge1: number, x: number): number => {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
};

/** Shortest cyclic distance between two points on the unit circle. */
const cyclicDistance = (a: number, b: number): number => {
  const d = Math.abs(a - b) % 1;
  return Math.min(d, 1 - d);
};

/** Horizontal position, in fractions of width, at a fractional frame. */
const emberX = (
  e: EmberSpec,
  y: number,
  frame: number,
  loopFrames: number,
): number => {
  const phase = frame / loopFrames;
  const curl = curlNoise(e.x0 * 2.1, y * 3.0, phase, e.turbSeed);
  const sway = Math.sin(TAU * (e.swayFreq * phase + e.swayPhase));
  return e.x0 + curl.x * e.turbAmp + sway * e.swayAmp;
};

export type EmberSample = {
  /** Fractions of width / height. */
  x: number;
  y: number;
  /** Direction of travel, normalised. */
  dx: number;
  dy: number;
  /** Distance travelled per frame, in fractions of height. */
  speed: number;
  heat: number;
  alpha: number;
  visible: boolean;
};

const makeSample = (): EmberSample => ({
  x: 0,
  y: 0,
  dx: 0,
  dy: -1,
  speed: 0,
  heat: 0,
  alpha: 0,
  visible: false,
});

export const createSample = makeSample;

/**
 * Evaluate one ember at `frame`, writing into `out`. Pure: the same frame
 * always produces the same sample, and frame `loopFrames` equals frame 0.
 */
export const sampleEmber = (
  e: EmberSpec,
  frame: number,
  loopFrames: number,
  aspect: number,
  out: EmberSample,
): EmberSample => {
  const span = 1 + 2 * MARGIN;
  const dist = span * e.distScale;
  const t = (((frame + e.offset) % e.cycle) + e.cycle) % e.cycle / e.cycle;

  const y = 1 + MARGIN - dist * t;

  // Below the bottom edge or well past the top: nothing to draw.
  if (y > 1 + MARGIN * 0.5 || y < -MARGIN * 0.5) {
    out.visible = false;
    return out;
  }

  const x = emberX(e, y, frame, loopFrames);

  // Streak orientation must follow the actual velocity vector, turbulence
  // included — so take it from the path itself rather than assuming vertical.
  const dt = 0.5;
  const tBack = (((frame - dt + e.offset) % e.cycle) + e.cycle) % e.cycle / e.cycle;
  const tFwd = (((frame + dt + e.offset) % e.cycle) + e.cycle) % e.cycle / e.cycle;
  const yBack = 1 + MARGIN - dist * tBack;
  const yFwd = 1 + MARGIN - dist * tFwd;
  const xBack = emberX(e, yBack, frame - dt, loopFrames);
  const xFwd = emberX(e, yFwd, frame + dt, loopFrames);

  // Convert the horizontal component to height units so the angle is correct
  // on a non-square frame.
  const vx = (xFwd - xBack) * aspect;
  const vy = yFwd - yBack;
  const vLen = Math.hypot(vx, vy) || 1e-6;

  const phase = frame / loopFrames;
  const flicker =
    1 +
    e.flickAmpA * Math.sin(TAU * (e.flickFreqA * phase + e.flickPhaseA)) +
    e.flickAmpB * Math.sin(TAU * (e.flickFreqB * phase + e.flickPhaseB));

  // Fade in as the ember enters, fade out as it cools and climbs away.
  const envelope = smoothstep(0, 0.06, t) * (1 - smoothstep(0.72, 1, t));

  const wink =
    e.winkWidth === 0
      ? 1
      : smoothstep(0, e.winkWidth, cyclicDistance(t, e.winkCenter));

  out.x = x;
  out.y = y;
  out.dx = vx / vLen;
  out.dy = vy / vLen;
  out.speed = vLen;
  out.heat = Math.max(0, e.heat0 * (1 - e.coolRate * t));
  out.alpha = Math.max(0, e.brightness * flicker * envelope * wink);
  out.visible = out.alpha > 0.004;
  return out;
};

export { HEAT_BUCKETS };
