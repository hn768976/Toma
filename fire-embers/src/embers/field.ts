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
const CYCLES = [90, 150, 225, 450] as const;

/**
 * Rise speed, in fractions of frame height per frame.
 *
 * Drawn log-uniformly rather than from a narrow band: tracking blobs through
 * the reference plate gives speeds spanning better than an order of magnitude
 * within a single frame, from embers that barely creep to ones that cross in
 * a couple of seconds. A tight speed distribution is what makes a particle
 * field read as an escalator instead of as convection.
 */
const SPEED_MIN = 0.0005;
const SPEED_MAX = 0.019;

/** Skews the draw toward the faster end; 1 would be plain log-uniform. */
const SPEED_SKEW = 0.88;

/** Ideal path length as a multiple of the full span, used to choose a cycle. */
const IDEAL_SPAN_MULTIPLE = 1.3;

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
  /** Where the ember's path begins, in fractions of height. */
  readonly yStart: number;

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
  r < 0.56 ? PINPOINT : r < 0.84 ? STREAK : ORB;

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

  // Speed is drawn first and the cycle is fitted to it, rather than the other
  // way round: deriving speed from distance/cycle ties it to the handful of
  // cycle lengths that divide 450 and collapses the distribution.
  // Near embers cover more ground per second than far ones — that parallax is
  // what sells depth without a camera — so depth biases the draw upward.
  const speedDraw = Math.min(1, rnd() * 0.78 + (1 - depth) * 0.26);
  const riseSpeed =
    SPEED_MIN *
    Math.pow(SPEED_MAX / SPEED_MIN, Math.pow(speedDraw, SPEED_SKEW));

  const span = 1 + 2 * MARGIN;
  // Pick the cycle whose resulting path length sits closest to the ideal.
  let cycle = CYCLES[CYCLES.length - 1];
  let bestFit = Infinity;
  for (const candidate of CYCLES) {
    const fit = Math.abs(
      Math.log((riseSpeed * candidate) / (span * IDEAL_SPAN_MULTIPLE)),
    );
    if (fit < bestFit) {
      bestFit = fit;
      cycle = candidate;
    }
  }
  const distScale = (riseSpeed * cycle) / span;

  // An ember whose path is shorter than the frame never traverses it, so it
  // cannot start at the bottom edge — it would only ever be seen down there.
  // Spread those over the full height instead; they still reset once per
  // cycle, invisibly, behind the fade envelope.
  const dist = distScale * span;
  const yStart =
    dist >= span ? 1 + MARGIN : range(rnd, dist - MARGIN, 1 + MARGIN);

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
    distScale: distScale * cfg.riseBoost,
    yStart,

    heat0,
    coolRate: range(rnd, 0.2, 0.65),
    heatBucket0: heatBucket(heat0),

    // Near embers are displaced more by the same field — closer to the eye.
    turbAmp: rangeBiased(rnd, 0.08, 0.8, 2.4) * (0.056 - depth * 0.030),
    turbSeed: Math.floor(rnd() * 4) * 0x1f3d,
    swayAmp: rangeBiased(rnd, 0.0008, 0.016, 2.2) * (1.2 - depth * 0.7),
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

/**
 * How much of the curl field's vertical component is applied, relative to its
 * horizontal one. Buoyancy dominates, so eddies push embers sideways more
 * readily than up or down — but not so much less that an ember can never be
 * carried backwards, which is what makes a field read as convection rather
 * than as an escalator.
 */
const VERTICAL_TURBULENCE = 0.62;

type Point = { x: number; y: number };

/**
 * Position at a fractional frame, in fractions of width and height. `t` is the
 * ember's own position in its cycle; the caller derives it so that the
 * velocity samples share one definition of the path.
 */
const emberPosition = (
  e: EmberSpec,
  t: number,
  frame: number,
  loopFrames: number,
  aspect: number,
  span: number,
): Point => {
  const yBase = e.yStart - span * e.distScale * t;
  const phase = frame / loopFrames;
  // Sample the field along the ember's progress through its cycle rather than
  // its actual travel, so a fast ember is not also deflected faster. Tying the
  // sample to real position couples deflection to rise speed, which throws the
  // fast tail of the speed distribution well past the reference.
  const noiseY = e.yStart - span * t;
  const curl = curlNoise(e.x0 * 1.5, noiseY * 1.9, phase, e.turbSeed);
  const sway = Math.sin(TAU * (e.swayFreq * phase + e.swayPhase));
  return {
    x: e.x0 + curl.x * e.turbAmp + sway * e.swayAmp,
    // turbAmp is in fractions of width; scale by the aspect ratio so a given
    // eddy displaces by the same number of pixels in both axes.
    y: yBase + curl.y * e.turbAmp * aspect * VERTICAL_TURBULENCE,
  };
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
  const cyclePos = (f: number) =>
    ((((f + e.offset) % e.cycle) + e.cycle) % e.cycle) / e.cycle;
  const t = cyclePos(frame);

  const here = emberPosition(e, t, frame, loopFrames, aspect, span);

  // Below the bottom edge or well past the top: nothing to draw.
  if (here.y > 1 + MARGIN * 0.5 || here.y < -MARGIN * 0.5) {
    out.visible = false;
    return out;
  }

  // Streak orientation must follow the actual velocity vector, turbulence
  // included — so take it from the path itself rather than assuming vertical.
  const dt = 0.5;
  const back = emberPosition(e, cyclePos(frame - dt), frame - dt, loopFrames, aspect, span);
  const fwd = emberPosition(e, cyclePos(frame + dt), frame + dt, loopFrames, aspect, span);

  // Convert the horizontal component to height units so the angle is correct
  // on a non-square frame.
  const vx = (fwd.x - back.x) * aspect;
  const vy = fwd.y - back.y;
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

  out.x = here.x;
  out.y = here.y;
  out.dx = vx / vLen;
  out.dy = vy / vLen;
  out.speed = vLen;
  out.heat = Math.max(0, e.heat0 * (1 - e.coolRate * t));
  out.alpha = Math.max(0, e.brightness * flicker * envelope * wink);
  out.visible = out.alpha > 0.004;
  return out;
};

export { HEAT_BUCKETS };
