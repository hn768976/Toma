/**
 * Deterministic layout and motion for a field of elements drifting on one
 * shared axis, with depth-driven scale, speed and opacity, and a density
 * distribution that concentrates the field in one diagonal half of the frame.
 *
 * Two ideas do most of the work here.
 *
 * CLOSED FORM, NOT INTEGRATION. An element's position is a function of
 * `t = (frame % loopFrames) / loopFrames`, never a running total. Frames can
 * be rendered out of order across workers, and t = 0 and t = 1 evaluate to
 * exactly the same numbers, which is what makes the loop seamless rather than
 * merely close.
 *
 * WHOLE CYCLES. Each element completes an integer number of traversals per
 * loop, and its wrap length is chosen to hit a target speed as closely as an
 * integer allows. Fractional cycles are the usual reason a "looping" field
 * jumps on the seam.
 *
 * The module is subject-agnostic: it knows nothing about what is being drawn,
 * what colour it is, or which way is forward. Direction arrives as a signed
 * vector, so flipping the sign flips the arrows, the drift, the wrap direction
 * and the shape alignment together.
 */

import { random } from "remotion";
import { DEG, TAU, lerp, rand, randPick } from "./random";
import { DepthBand, bandForDepth } from "./depthBuffers";

export type Viewport = { width: number; height: number };

/** Normalised frame corner: x 0 = left / 1 = right, y 0 = top / 1 = bottom. */
export type Corner = { x: 0 | 1; y: 0 | 1 };

export type DensityFalloff = {
  /** >1 pulls the zero point inside the opposite corner, emptying it sooner. */
  reach: number;
  /** Higher concentrates the mass harder into the dense corner. */
  exponent: number;
};

export const DEFAULT_FALLOFF: DensityFalloff = { reach: 1.06, exponent: 2 };

export type DriftRamps = {
  /** Depth range. zMin is the far plane. */
  zMin: number;
  zMax: number;
  scaleFar: number;
  scaleNear: number;
  sizeJitter: { min: number; max: number };
  opacityFar: number;
  opacityNear: number;
  /** Target drift speed in composition px per frame, at each depth extreme. */
  speedFar: number;
  speedNear: number;
  /** Amplitude of the slow seeded rotation wobble, in degrees. */
  wobbleDeg: number;
  /** Whole cycles per loop available to wobble and breathe. All must divide the loop. */
  cycleChoices: readonly number[];
  loopFrames: number;
};

/* ------------------------------------------------------------------ *
 * The shared axis
 * ------------------------------------------------------------------ */

export type AxisFrame = {
  /** Unit vector along the drift axis. */
  ax: number;
  ay: number;
  /** Unit vector across it. */
  px: number;
  py: number;
  /**
   * Canvas rotation, in radians, that turns a sprite drawn pointing towards
   * +y (down its own canvas) into a sprite pointing along the axis.
   */
  angle: number;
  /** How far the frame reaches along / across the axis. */
  axisExtent: number;
  perpExtent: number;
};

export const axisFrame = (
  drift: { x: number; y: number },
  viewport: Viewport,
): AxisFrame => {
  const len = Math.hypot(drift.x, drift.y) || 1;
  const ax = drift.x / len;
  const ay = drift.y / len;
  const px = -ay;
  const py = ax;
  return {
    ax,
    ay,
    px,
    py,
    angle: Math.atan2(ay, ax) - Math.PI / 2,
    axisExtent: viewport.width * Math.abs(ax) + viewport.height * Math.abs(ay),
    perpExtent: viewport.width * Math.abs(px) + viewport.height * Math.abs(py),
  };
};

/* ------------------------------------------------------------------ *
 * Density falloff
 * ------------------------------------------------------------------ */

/**
 * Weight in [0, 1] describing how much of the field belongs at (x, y):
 * 1 at the dense corner, falling smoothly to 0 at the opposite corner.
 *
 * Use it twice. Once to bias where elements are seeded, so the dense corner
 * holds more of them. And once per frame, on each element's CURRENT position,
 * so an element that drifts into the open corner fades out instead of
 * arriving there at full strength. The second use is the one that keeps the
 * corner genuinely open over the whole loop — seeding alone will not, because
 * every element eventually traverses the whole frame.
 */
export const densityWeight = (
  x: number,
  y: number,
  corner: Corner,
  viewport: Viewport,
  falloff: DensityFalloff = DEFAULT_FALLOFF,
) => {
  const nx = x / viewport.width;
  const ny = y / viewport.height;
  const gx = corner.x === 1 ? 1 - nx : nx;
  const gy = corner.y === 1 ? 1 - ny : ny;
  const g = (gx + gy) / 2;
  const base = 1 - g * falloff.reach;
  return base <= 0 ? 0 : Math.min(1, Math.pow(base, falloff.exponent));
};

/* ------------------------------------------------------------------ *
 * Elements
 * ------------------------------------------------------------------ */

export type DriftElement = {
  seed: string;
  z: number;
  band: number;
  /** Uniform scale applied to the sprite. */
  sizeMul: number;
  /** Extra scale on the short axis only. */
  widthMul: number;
  spriteIndex: number;
  /** Static rotation off the shared axis, in radians. */
  tilt: number;
  wobbleAmp: number;
  wobbleCycles: number;
  wobblePhase: number;
  breatheCycles: number;
  breathePhase: number;
  /** Phase along the axis at t = 0. */
  u0: number;
  /** Whole cycles completed in one loop. Never fractional — that is the loop. */
  cycles: number;
  /** Wrap length along the axis. Always long enough to wrap off-frame. */
  travel: number;
  /** Wrap width across the axis. */
  lateral: number;
  /** One seeded lateral position per cycle; a fresh one is taken at each wrap. */
  lanes: number[];
  depthAlpha: number;
  /** Rotation-safe half diagonal of the drawn sprite. Used to cull and to size the wrap margin. */
  halfExtent: number;
};

export type ElementSpec = {
  /** Stable seed prefix. Changing it reshuffles the whole group. */
  key: string;
  count: number;
  /** Half the sprite's diagonal at sizeMul = 1. Sets the wrap margin. */
  baseHalfExtent: (spriteIndex: number) => number;
  spriteCount: number;
  /** Static tilt off the axis, in degrees (±). */
  tiltDeg: number;
  /** Extra multiplier on sizeMul, e.g. to enlarge one sub-group. */
  sizeBoost?: number;
  widthJitter?: { min: number; max: number };
};

export type BuildOptions = {
  viewport: Viewport;
  ramps: DriftRamps;
  bands: readonly DepthBand[];
  falloff?: DensityFalloff;
};

/**
 * Chooses a lateral lane biased towards the dense corner.
 *
 * Rejection sampling on the seeded stream: a candidate is accepted with
 * probability proportional to the density weight at the position the element
 * would occupy halfway through its traverse. Trials are bounded and it falls
 * back to the best candidate seen, so it always terminates with the same
 * answer on every machine.
 */
const seedLane = (
  seed: string,
  lane: number,
  axis: AxisFrame,
  lateral: number,
  corner: Corner,
  viewport: Viewport,
  falloff: DensityFalloff,
) => {
  let best = 0.5;
  let bestWeight = -1;
  for (let trial = 0; trial < 24; trial++) {
    const v = random(`${seed}:lane:${lane}:v:${trial}`);
    const off = (v - 0.5) * lateral;
    const x = viewport.width / 2 + axis.px * off;
    const y = viewport.height / 2 + axis.py * off;
    const w = densityWeight(x, y, corner, viewport, falloff);
    if (w > bestWeight) {
      bestWeight = w;
      best = v;
    }
    if (random(`${seed}:lane:${lane}:accept:${trial}`) < Math.pow(w, 0.8)) {
      return v;
    }
  }
  return best;
};

export const buildElements = (
  spec: ElementSpec,
  axis: AxisFrame,
  corner: Corner,
  options: BuildOptions,
): DriftElement[] => {
  const { viewport, ramps, bands } = options;
  const falloff = options.falloff ?? DEFAULT_FALLOFF;
  const out: DriftElement[] = [];

  for (let i = 0; i < spec.count; i++) {
    const seed = `${spec.key}:${i}`;
    const z = lerp(ramps.zMin, ramps.zMax, random(`${seed}:z`));
    const depthT = (z - ramps.zMin) / (ramps.zMax - ramps.zMin);

    const spriteIndex = Math.min(
      spec.spriteCount - 1,
      Math.floor(random(`${seed}:sprite`) * spec.spriteCount),
    );
    const sizeMul =
      lerp(ramps.scaleFar, ramps.scaleNear, depthT) *
      rand(`${seed}:size`, ramps.sizeJitter.min, ramps.sizeJitter.max) *
      (spec.sizeBoost ?? 1);
    const widthMul = spec.widthJitter
      ? rand(`${seed}:width`, spec.widthJitter.min, spec.widthJitter.max)
      : 1;

    const halfExtent = spec.baseHalfExtent(spriteIndex) * sizeMul;
    // Shortest wrap that still hides the jump off-frame.
    const minTravel = axis.axisExtent + 2 * halfExtent + 60;
    const targetSpeed =
      lerp(ramps.speedFar, ramps.speedNear, depthT) *
      rand(`${seed}:speed`, 0.9, 1.15);
    // The whole-cycle count nearest the target speed, and the wrap length that
    // hits that speed given the count. Never shorter than minTravel, or the
    // element would wrap in view.
    const cycles = Math.max(
      1,
      Math.round((targetSpeed * ramps.loopFrames) / minTravel),
    );
    const travel = Math.max(minTravel, (targetSpeed * ramps.loopFrames) / cycles);
    const lateral = axis.perpExtent + 2 * halfExtent + 60;

    const lanes: number[] = [];
    for (let lane = 0; lane < cycles; lane++) {
      lanes.push(seedLane(seed, lane, axis, lateral, corner, viewport, falloff));
    }

    out.push({
      seed,
      z,
      band: bandForDepth(bands, z),
      sizeMul,
      widthMul,
      spriteIndex,
      tilt: rand(`${seed}:tilt`, -spec.tiltDeg, spec.tiltDeg) * DEG,
      wobbleAmp: rand(`${seed}:wobamp`, 0.35, 1) * ramps.wobbleDeg * DEG,
      wobbleCycles: randPick(`${seed}:wobcyc`, ramps.cycleChoices),
      wobblePhase: random(`${seed}:wobph`) * TAU,
      breatheCycles: randPick(`${seed}:brcyc`, ramps.cycleChoices),
      breathePhase: random(`${seed}:brph`) * TAU,
      u0: random(`${seed}:u0`),
      cycles,
      travel,
      lateral,
      lanes,
      depthAlpha: lerp(ramps.opacityFar, ramps.opacityNear, depthT),
      halfExtent,
    });
  }
  return out;
};

export type Placement = {
  x: number;
  y: number;
  rotation: number;
  alpha: number;
};

/**
 * Where an element is, and how bright, at loop position `t` in [0, 1).
 *
 * `k` counts completed wraps, and the lane is picked by `k mod cycles`. So an
 * element takes a fresh seeded lateral position every time it leaves the frame
 * and still returns to lane 0 at t = 1 — the wrap reseeding does not break the
 * loop. (An element with a single cycle per loop necessarily keeps one lane:
 * it exits once, and a closed loop requires it back where it started.)
 */
export const placeElement = (
  el: DriftElement,
  axis: AxisFrame,
  corner: Corner,
  t: number,
  options: { viewport: Viewport; falloff?: DensityFalloff },
): Placement => {
  const { viewport } = options;
  const p = el.u0 + el.cycles * t;
  const k = Math.floor(p);
  const u = p - k;
  const lane = ((k % el.cycles) + el.cycles) % el.cycles;
  const along = (u - 0.5) * el.travel;
  const across = (el.lanes[lane] - 0.5) * el.lateral;

  const x = viewport.width / 2 + axis.ax * along + axis.px * across;
  const y = viewport.height / 2 + axis.ay * along + axis.py * across;

  const rotation =
    axis.angle +
    el.tilt +
    el.wobbleAmp * Math.sin(TAU * el.wobbleCycles * t + el.wobblePhase);

  const breathe =
    0.82 + 0.18 * Math.sin(TAU * el.breatheCycles * t + el.breathePhase);

  return {
    x,
    y,
    rotation,
    alpha:
      el.depthAlpha *
      densityWeight(x, y, corner, viewport, options.falloff) *
      breathe,
  };
};
