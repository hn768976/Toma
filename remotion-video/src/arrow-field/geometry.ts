/**
 * Deterministic layout and motion for every element in the field.
 *
 * Nothing here reads the clock. An element's position is a closed-form
 * function of `t = (frame % LOOP_FRAMES) / LOOP_FRAMES`, so frames can be
 * rendered out of order across workers and still agree, and t = 0 and t = 1
 * evaluate to exactly the same numbers.
 *
 * All randomness comes from Remotion's `random()` with stable string seeds.
 */

import { random } from "remotion";
import {
  BandIndex,
  CYCLE_CHOICES,
  HEIGHT,
  LOOP_FRAMES,
  MAX_SIZE_MUL,
  OPACITY_FAR,
  OPACITY_NEAR,
  SCALE_FAR,
  SCALE_NEAR,
  SIZE_JITTER,
  SPEED_FAR,
  SPEED_NEAR,
  WIDTH,
  WOBBLE_DEG,
  Z_MAX,
  Z_MIN,
  bandForDepth,
} from "./constants";
import { Corner } from "./variants";

export const TAU = Math.PI * 2;
export const DEG = Math.PI / 180;

export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);

/** Seeded uniform in [min, max). */
export const rand = (seed: string, min = 0, max = 1) =>
  min + random(seed) * (max - min);

/** Seeded pick from a list. */
export const randPick = <T>(seed: string, list: readonly T[]): T =>
  list[Math.min(list.length - 1, Math.floor(random(seed) * list.length))];

/** Seeded integer in [min, max]. */
export const randInt = (seed: string, min: number, max: number) =>
  Math.min(max, min + Math.floor(random(seed) * (max - min + 1)));

/* ------------------------------------------------------------------ *
 * The shared axis
 * ------------------------------------------------------------------ */

export type AxisFrame = {
  /** Unit vector along the drift axis (also the direction arrows point). */
  ax: number;
  ay: number;
  /** Unit vector across it. */
  px: number;
  py: number;
  /**
   * Canvas rotation, in radians, that turns a sprite drawn pointing towards
   * +y (down the sprite canvas) into a sprite pointing along the axis.
   */
  angle: number;
  /** How far the 4K frame reaches along / across the axis. */
  axisExtent: number;
  perpExtent: number;
};

export const axisFrame = (drift: { x: number; y: number }): AxisFrame => {
  const len = Math.hypot(drift.x, drift.y) || 1;
  const ax = drift.x / len;
  const ay = drift.y / len;
  // Perpendicular, rotated a quarter turn.
  const px = -ay;
  const py = ax;
  return {
    ax,
    ay,
    px,
    py,
    angle: Math.atan2(ay, ax) - Math.PI / 2,
    axisExtent: WIDTH * Math.abs(ax) + HEIGHT * Math.abs(ay),
    perpExtent: WIDTH * Math.abs(px) + HEIGHT * Math.abs(py),
  };
};

/* ------------------------------------------------------------------ *
 * Density falloff
 * ------------------------------------------------------------------ */

/**
 * Weight in [0, 1] describing how much of the field belongs at (x, y).
 * 1 at the dense corner, falling smoothly to 0 at the opposite corner.
 *
 * It is used twice: to bias where elements are seeded across the frame, and
 * to scale every element's opacity at its *current* position. The second use
 * is what keeps the open corner genuinely open — an element that drifts into
 * it fades out rather than arriving there at full strength.
 */
export const densityWeight = (x: number, y: number, corner: Corner) => {
  const nx = x / WIDTH;
  const ny = y / HEIGHT;
  const gx = corner.x === 1 ? 1 - nx : nx;
  const gy = corner.y === 1 ? 1 - ny : ny;
  const g = (gx + gy) / 2;
  const base = 1 - g * 1.06;
  return base <= 0 ? 0 : Math.min(1, Math.pow(base, 2));
};

/* ------------------------------------------------------------------ *
 * Elements
 * ------------------------------------------------------------------ */

export type DriftElement = {
  seed: string;
  z: number;
  band: BandIndex;
  /** Uniform scale applied to the sprite. */
  sizeMul: number;
  /** Extra scale on the short axis only, for shape variety without more sprites. */
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
  /** One seeded lateral position per cycle; the element takes a new one each wrap. */
  lanes: number[];
  depthAlpha: number;
  /** Rotation-safe half diagonal of the drawn sprite, in 4K px. Used to cull. */
  halfExtent: number;
};

export type ElementSpec = {
  /** Stable seed prefix; changing it reshuffles the whole group. */
  key: string;
  count: number;
  /** Half the sprite's diagonal at sizeMul = 1, in 4K px. Sets the wrap margin. */
  baseHalfExtent: (spriteIndex: number) => number;
  spriteCount: number;
  /** Static tilt off the axis, in degrees (±). */
  tiltDeg: number;
  /** Extra multiplier on sizeMul, e.g. to enlarge outline-only arrows. */
  sizeBoost?: number;
  widthJitter?: { min: number; max: number };
};

/**
 * Chooses a lateral lane biased towards the dense corner.
 *
 * Rejection sampling on the seeded stream: a candidate lane is accepted with
 * probability proportional to the density weight at the position the element
 * would occupy halfway through its traverse (the point where it crosses the
 * middle of the frame). Bounded trials, and it falls back to the best
 * candidate seen, so it always terminates with the same answer.
 */
const seedLane = (
  seed: string,
  lane: number,
  axis: AxisFrame,
  lateral: number,
  corner: Corner,
) => {
  let best = 0.5;
  let bestWeight = -1;
  for (let trial = 0; trial < 24; trial++) {
    const v = random(`${seed}:lane:${lane}:v:${trial}`);
    const off = (v - 0.5) * lateral;
    const x = WIDTH / 2 + axis.px * off;
    const y = HEIGHT / 2 + axis.py * off;
    const w = densityWeight(x, y, corner);
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
): DriftElement[] => {
  const out: DriftElement[] = [];
  for (let i = 0; i < spec.count; i++) {
    const seed = `${spec.key}:${i}`;
    const z = lerp(Z_MIN, Z_MAX, random(`${seed}:z`));
    const depthT = (z - Z_MIN) / (Z_MAX - Z_MIN);

    const spriteIndex = Math.min(
      spec.spriteCount - 1,
      Math.floor(random(`${seed}:sprite`) * spec.spriteCount),
    );
    const sizeMul =
      lerp(SCALE_FAR, SCALE_NEAR, depthT) *
      rand(`${seed}:size`, SIZE_JITTER.min, SIZE_JITTER.max) *
      (spec.sizeBoost ?? 1);
    const widthMul = spec.widthJitter
      ? rand(`${seed}:width`, spec.widthJitter.min, spec.widthJitter.max)
      : 1;

    const halfExtent = spec.baseHalfExtent(spriteIndex) * sizeMul;
    // Shortest wrap that still hides the jump off-frame.
    const minTravel = axis.axisExtent + 2 * halfExtent + 60;
    const targetSpeed =
      lerp(SPEED_FAR, SPEED_NEAR, depthT) * rand(`${seed}:speed`, 0.9, 1.15);
    // Whole cycles per loop — the value that makes the motion close.
    const cycles = Math.max(
      1,
      Math.round((targetSpeed * LOOP_FRAMES) / minTravel),
    );
    const travel = Math.max(minTravel, (targetSpeed * LOOP_FRAMES) / cycles);
    const lateral = axis.perpExtent + 2 * halfExtent + 60;

    const lanes: number[] = [];
    for (let lane = 0; lane < cycles; lane++) {
      lanes.push(seedLane(seed, lane, axis, lateral, corner));
    }

    out.push({
      seed,
      z,
      band: bandForDepth(z),
      sizeMul,
      widthMul,
      spriteIndex,
      tilt: rand(`${seed}:tilt`, -spec.tiltDeg, spec.tiltDeg) * DEG,
      wobbleAmp: rand(`${seed}:wobamp`, 0.35, 1) * WOBBLE_DEG * DEG,
      wobbleCycles: randPick(`${seed}:wobcyc`, CYCLE_CHOICES),
      wobblePhase: random(`${seed}:wobph`) * TAU,
      breatheCycles: randPick(`${seed}:brcyc`, CYCLE_CHOICES),
      breathePhase: random(`${seed}:brph`) * TAU,
      u0: random(`${seed}:u0`),
      cycles,
      travel,
      lateral,
      lanes,
      depthAlpha: lerp(OPACITY_FAR, OPACITY_NEAR, depthT),
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
 * `k` counts completed wraps. The lane is picked by `k mod cycles`, so an
 * element takes a fresh seeded lateral position every time it leaves the
 * frame, and still returns to lane 0 at t = 1 — the wrap reseeding does not
 * break the loop.
 */
export const placeElement = (
  el: DriftElement,
  axis: AxisFrame,
  corner: Corner,
  t: number,
): Placement => {
  const p = el.u0 + el.cycles * t;
  const k = Math.floor(p);
  const u = p - k;
  const lane = ((k % el.cycles) + el.cycles) % el.cycles;
  const along = (u - 0.5) * el.travel;
  const across = (el.lanes[lane] - 0.5) * el.lateral;

  const x = WIDTH / 2 + axis.ax * along + axis.px * across;
  const y = HEIGHT / 2 + axis.ay * along + axis.py * across;

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
    alpha: el.depthAlpha * densityWeight(x, y, corner) * breathe,
  };
};

/** Largest sprite scale in the field; sprites are built at this size and only ever scaled down. */
export const maxSpriteScale = MAX_SIZE_MUL;
