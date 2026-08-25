import {random} from 'remotion';
import * as C from './constants';
import {lift, mix} from './color';
import {HERO_SNIPPETS, makeBinary, makeSnippet} from './snippets';
import type {Variant} from './variant';

export type Kind = 'code' | 'icon' | 'binary' | 'streak' | 'accent' | 'hero';

export interface FieldElement {
  id: string;
  kind: Kind;
  /** Depth, 0.15 (far) .. 1.0 (right by the lens). */
  z: number;
  /** Screen scale multiplier, z * MAX_SCALE. */
  scale: number;
  /** Radians. The shared diagonal plus a small per-element jitter. */
  rot: number;
  /** px per frame along the diagonal. */
  speed: number;
  /** Wrap distance along the diagonal. */
  travel: number;
  /** Whole number of wrap cycles inside 540 frames -> seamless loop. */
  cycles: number;
  /** Starting position along the wrap, 0..1. */
  phase: number;
  /** Fixed offset perpendicular to the diagonal. */
  perp: number;
  /** Depth-of-field blur, in screen px. */
  blur: number;
  alpha: number;
  /** Motion-blur sample count. 1 means no smear. */
  steps: number;
  /** Native, unscaled content size. */
  w0: number;
  h0: number;
  color: string;
  commentColor: string;
  lines: string[];
  fontPx: number;
  weight: number;
  /** Extra bloom weighting for the brightest elements. */
  glow: number;
  /** streak only */
  streakThickness: number;
  /** accent only */
  squareSize: number;
  /** hero only: how many leading lines are already written on entry. */
  staticLines: number;
  /** hero only: one colour per line. */
  lineColors: string[];
  /** hero only: half-width of the mid-crossing stop, as a fraction of it. */
  dwell: number;
  /** hero only: where in the 540-frame loop this hero's crossing begins. */
  timeOffset: number;
}

export type Measure = (
  lines: string[],
  fontPx: number,
  weight: number,
) => number;

const rr = (seed: string, lo: number, hi: number) => lo + (hi - lo) * random(seed);

const rint = (seed: string, lo: number, hi: number) =>
  lo + Math.floor(random(seed) * (hi - lo + 1));

const pick = <T,>(seed: string, arr: readonly T[]): T =>
  arr[Math.floor(random(seed) * arr.length) % arr.length] as T;

/**
 * Depth distribution.
 *
 * The body of the field is triangular and mid-heavy, which puts roughly a
 * fifth of it inside the narrow focal band. On top of that a fixed share is
 * drawn straight from the near band, so there is always a foreground layer
 * sweeping past the lens instead of leaving it to chance.
 */
const depth = (seed: string, nearShare = 0) => {
  if (nearShare > 0 && random(seed + ':near') < nearShare) {
    return 0.76 + 0.24 * random(seed + ':znear');
  }
  const t = (random(seed + ':z1') + random(seed + ':z2')) / 2;
  return C.Z_MIN + (0.78 - C.Z_MIN) * t;
};

/** Sharp in a narrow mid band, blurred hard toward the lens, softly far away. */
export const blurFor = (z: number) => {
  const lo = C.Z_FOCUS - C.FOCUS_BAND;
  const hi = C.Z_FOCUS + C.FOCUS_BAND;
  if (z >= lo && z <= hi) return 0;
  if (z < lo) {
    const t = (lo - z) / (lo - C.Z_MIN);
    return Math.pow(t, 1.25) * C.FAR_BLUR_MAX;
  }
  const t = (z - hi) / (C.Z_MAX - hi);
  return Math.pow(t, 1.35) * C.NEAR_BLUR_MAX;
};

const smooth = (t: number) => t * t * (3 - 2 * t);

/** Lower at both extremes of the depth range. */
export const alphaFor = (z: number) => {
  const lo = 0.36;
  const hi = 0.56;
  const peak = 0.92;
  if (z >= lo && z <= hi) return peak;
  if (z < lo) {
    const t = smooth(Math.max(0, Math.min(1, (lo - z) / (lo - C.Z_MIN))));
    return peak * (1 - 0.68 * t);
  }
  const t = smooth(Math.max(0, Math.min(1, (z - hi) / (C.Z_MAX - hi))));
  return peak * (1 - 0.72 * t);
};

const stepsFor = (speed: number) => {
  if (speed < 16) return 1;
  if (speed < 28) return 3;
  if (speed < 42) return 4;
  return 5;
};

const jitterRot = (seed: string, v: Variant) =>
  v.tiltRad + (rr(seed, -1, 1) * C.ROT_JITTER_DEG * Math.PI) / 180;

/**
 * Resolves the wrap geometry for one element.
 *
 * The loop closes because travel * cycles === speed * DURATION exactly, so at
 * frame 540 every element has completed a whole number of wraps and sits on
 * its frame-0 position.
 */
const wrapFor = (z: number, axisExtent: number, v: Variant) => {
  const need = v.axisView + axisExtent + 60;
  const wanted = z * C.BASE_SPEED;
  const total = wanted * v.durationInFrames;
  if (total < need) {
    // Too slow to clear the frame once per loop; walk it at the minimum speed.
    return {speed: need / v.durationInFrames, travel: need, cycles: 1};
  }
  const cycles = Math.max(1, Math.floor(total / need));
  return {speed: wanted, travel: total / cycles, cycles};
};

/**
 * Perpendicular offsets, one evenly spaced slot per element so the field never
 * clumps, then shuffled.
 *
 * The shuffle matters: `phase` is also stratified by index, so handing out
 * perpendicular slots in index order would tie an element's position across
 * the frame to its position along the diagonal and carve the field into empty
 * diagonal bands.
 */
const perpSlots = (seed: string, n: number, v: Variant): number[] => {
  const slots = Array.from(
    {length: n},
    (_, i) => (-0.5 + (i + random(`${seed}:jit${i}`)) / n) * v.perpSpread,
  );
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(random(`${seed}:swap${i}`) * (i + 1));
    const tmp = slots[i] as number;
    slots[i] = slots[j] as number;
    slots[j] = tmp;
  }
  return slots;
};

const codeColor = (seed: string, z: number, v: Variant) => {
  const {code, codeBright, icon, dim} = v.palette;
  const r = random(seed);
  // The dominant colour carries the shot. The bright tone is reserved for the
  // closest fragments and stays rare even there, or the field goes chalky.
  if (z >= 0.68) return r < 0.4 ? codeBright : code;
  if (z >= 0.3) {
    if (r < 0.09) return codeBright;
    return r < 0.32 ? mix(code, icon, 0.5) : code;
  }
  return r < 0.2 ? mix(dim, code, 0.4) : dim;
};

const base = (
  id: string,
  kind: Kind,
  z: number,
  scaleMul: number,
  w0: number,
  h0: number,
  i: number,
  n: number,
  perp: number,
  v: Variant,
  blurMul = 1,
): FieldElement => {
  const scale = z * scaleMul * (0.88 + 0.24 * random(id + ':sj'));
  const axisExtent = w0 * scale + h0 * scale * 0.12;
  const {speed, travel, cycles} = wrapFor(z, axisExtent, v);
  return {
    id,
    kind,
    z,
    scale,
    rot: jitterRot(id + ':rot', v),
    speed,
    travel,
    cycles,
    phase: (i + random(id + ':phase')) / n,
    perp,
    blur: blurFor(z) * blurMul,
    alpha: alphaFor(z),
    steps: stepsFor(speed),
    w0,
    h0,
    color: v.palette.code,
    commentColor: v.palette.codeBright,
    lines: [],
    fontPx: C.FONT_PX,
    weight: 400,
    glow: 0,
    streakThickness: 0,
    squareSize: 0,
    staticLines: 0,
    lineColors: [],
    dwell: 0,
    timeOffset: 0,
  };
};

/**
 * Generates the whole element set once. Seeded, so it is identical in every
 * render worker and stable across the entire 540 frames.
 */
export const buildField = (measure: Measure, v: Variant): FieldElement[] => {
  const out: FieldElement[] = [];

  const codePerp = perpSlots('perp:code', C.COUNT_CODE, v);
  const iconPerp = perpSlots('perp:icon', C.COUNT_ICON, v);
  const binPerp = perpSlots('perp:bin', C.COUNT_BINARY, v);
  const streakPerp = perpSlots('perp:streak', C.COUNT_STREAK, v);
  const accentPerp = perpSlots('perp:accent', C.COUNT_ACCENT, v);

  // 1. CODE FRAGMENTS ------------------------------------------------------
  for (let i = 0; i < C.COUNT_CODE; i++) {
    const id = `code-${i}`;
    const z = depth(id, 0.18);
    const lines = makeSnippet(id);
    const weight = z > 0.55 ? 500 : 400;
    const w0 = measure(lines, C.FONT_PX, weight);
    const h0 = lines.length * C.FONT_PX * C.LINE_HEIGHT;
    const el = base(id, 'code', z, C.MAX_SCALE, w0, h0, i, C.COUNT_CODE, codePerp[i] as number, v);
    el.lines = lines;
    el.weight = weight;
    el.color = codeColor(id + ':col', z, v);
    el.commentColor = lift(el.color, z >= 0.3 ? 0.34 : 0.26);
    el.glow = z >= 0.55 ? 1 : 0.45;
    el.alpha *= 0.82;
    out.push(el);
  }

  // 2. CHATBOT ICONS -------------------------------------------------------
  for (let i = 0; i < C.COUNT_ICON; i++) {
    const id = `icon-${i}`;
    const z = depth(id, 0.2);
    const el = base(id, 'icon', z, C.MAX_SCALE * 0.92, 140, 126, i, C.COUNT_ICON, iconPerp[i] as number, v);
    el.color =
      z < 0.3
        ? mix(v.palette.icon, v.palette.dim, 0.6)
        : z > 0.72
          ? lift(v.palette.icon, 0.18)
          : v.palette.icon;
    el.glow = 0.5;
    out.push(el);
  }

  // 3. BINARY STRINGS ------------------------------------------------------
  for (let i = 0; i < C.COUNT_BINARY; i++) {
    const id = `bin-${i}`;
    // Mostly mid and far; a handful ride right up against the lens.
    const near = random(id + ':near') < 0.25;
    const z = near ? rr(id + ':znear', 0.74, 1.0) : rr(id + ':zfar', 0.18, 0.62);
    const text = makeBinary(id);
    const weight = 400;
    const w0 = measure([text], C.FONT_PX, weight);
    const h0 = C.FONT_PX * C.LINE_HEIGHT;
    const el = base(id, 'binary', z, C.MAX_SCALE, w0, h0, i, C.COUNT_BINARY, binPerp[i] as number, v);
    el.lines = [text];
    el.weight = weight;
    el.color = near
      ? pick(id + ':acc', [v.palette.accents[1] as string, v.palette.accents[0] as string])
      : z < 0.34
        ? v.palette.dim
        : mix(v.palette.dim, v.palette.code, 0.62);
    el.commentColor = el.color;
    // Dimmer than the code around them.
    el.alpha *= near ? 0.85 : 0.62;
    el.glow = near ? 1 : 0.3;
    out.push(el);
  }

  // 4. STREAKS -------------------------------------------------------------
  for (let i = 0; i < C.COUNT_STREAK; i++) {
    const id = `streak-${i}`;
    // Mostly high z: these are the fast, near, barely-there passes.
    const z = rr(id + ':z', 0.5, 1.0);
    const w0 = rr(id + ':len', 220, 760);
    const thickness = rr(id + ':th', 3, 7);
    const el = base(id, 'streak', z, C.MAX_SCALE * 0.8, w0, thickness, i, C.COUNT_STREAK, streakPerp[i] as number, v, 0.35);
    el.streakThickness = thickness;
    el.color =
      random(id + ':c') < 0.12
        ? v.palette.codeBright
        : mix(v.palette.code, v.palette.icon, 0.4);
    el.alpha = rr(id + ':a', 0.05, 0.17);
    el.glow = 0.25;
    out.push(el);
  }

  // 5. ACCENT SQUARES ------------------------------------------------------
  for (let i = 0; i < C.COUNT_ACCENT; i++) {
    const id = `accent-${i}`;
    const z = depth(id, 0.15);
    const size = rint(id + ':sz', 13, 24);
    const el = base(id, 'accent', z, C.MAX_SCALE, size, size, i, C.COUNT_ACCENT, accentPerp[i] as number, v, 0.35);
    el.squareSize = size;
    el.color = pick(id + ':col', v.palette.accents);
    el.alpha = Math.min(1, el.alpha * 1.35);
    el.glow = 1.2;
    out.push(el);
  }

  // 6. HERO FRAGMENTS ------------------------------------------------------
  // Large, sharp, on the shared tilt, with their second half typing out as
  // they cross. Phase-offset by half a loop so they take turns crossing.
  for (let i = 0; i < C.COUNT_HERO; i++) {
    const id = `hero-${i}`;
    const hero = HERO_SNIPPETS[i % HERO_SNIPPETS.length] as (typeof HERO_SNIPPETS)[number];
    const w0 = measure(hero.lines, C.FONT_PX, 500);
    const h0 = hero.lines.length * C.FONT_PX * C.LINE_HEIGHT;
    const el = base(id, 'hero', C.HERO_Z, 0, w0, h0, i, C.COUNT_HERO, 0, v);
    el.scale = C.HERO_SCALE;
    el.lines = [...hero.lines];
    el.staticLines = hero.staticLines;
    el.weight = 500;
    el.blur = 0;
    // The hero is what the eye reads. It does not get smeared.
    el.steps = 1;
    // Offset from centre by a little over half the block's own height, one
    // each way. Keying this to the block rather than to the field's spread is
    // what keeps the two clear of each other at any tilt - at zero tilt the
    // perpendicular spread is the frame height, far narrower than on the
    // diagonal, and a fraction of it would sit them on top of one another.
    el.perp = (i === 0 ? -1 : 1) * h0 * el.scale * 0.62;
    el.color = v.palette.code;
    el.commentColor = v.palette.codeBright;
    el.lineColors = hero.lines.map((line, li) => {
      if (li === 0) return v.palette.codeBright;
      if (line.startsWith('<')) return v.palette.code;
      return lift(v.palette.code, 0.5);
    });
    el.glow = 1.3;

    // One crossing per loop, at whatever speed that implies, rather than the
    // speed its depth would give it: a hero that is meant to be read cannot
    // also be moving at mid-field pace.
    const axisExtent = w0 * el.scale + h0 * el.scale * 0.12;
    el.travel = (v.axisView + axisExtent + 60) * C.HERO_TRAVEL_MULT;
    el.cycles = 1;
    el.speed = el.travel / v.durationInFrames;

    // phase 0 puts the stop exactly at frame centre; timeOffset decides when
    // in the loop it happens. Half a loop apart, so they take turns.
    el.phase = 0;
    el.dwell = v.heroDwell;
    el.timeOffset = i === 0 ? 0.35 : 0.85;

    out.push(el);
  }

  return out;
};
