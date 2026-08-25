import {random} from 'remotion';
import * as C from './constants';
import {lift, mix} from './color';
import {makeBinary, makeSnippet} from './snippets';

export type Kind = 'code' | 'icon' | 'binary' | 'streak' | 'accent';

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

const jitterRot = (seed: string) =>
  C.DIAG_RAD + (rr(seed, -1, 1) * C.ROT_JITTER_DEG * Math.PI) / 180;

/**
 * Resolves the wrap geometry for one element.
 *
 * The loop closes because travel * cycles === speed * DURATION exactly, so at
 * frame 540 every element has completed a whole number of wraps and sits on
 * its frame-0 position.
 */
const wrapFor = (z: number, axisExtent: number) => {
  const need = C.AXIS_VIEW + axisExtent + 60;
  const wanted = z * C.BASE_SPEED;
  const total = wanted * C.DURATION;
  if (total < need) {
    // Too slow to clear the frame once in 540; walk it at the minimum speed.
    return {speed: need / C.DURATION, travel: need, cycles: 1};
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
const perpSlots = (seed: string, n: number): number[] => {
  const slots = Array.from(
    {length: n},
    (_, i) => (-0.5 + (i + random(`${seed}:jit${i}`)) / n) * C.PERP_SPREAD,
  );
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(random(`${seed}:swap${i}`) * (i + 1));
    const tmp = slots[i] as number;
    slots[i] = slots[j] as number;
    slots[j] = tmp;
  }
  return slots;
};

const codeColor = (seed: string, z: number) => {
  const r = random(seed);
  // Cyan carries the shot. White is reserved for the closest fragments and
  // stays rare even there, otherwise the field goes chalky.
  if (z >= 0.68) return r < 0.4 ? C.COLORS.codeWhite : C.COLORS.codeCyan;
  if (z >= 0.3) {
    if (r < 0.09) return C.COLORS.codeWhite;
    return r < 0.32 ? mix(C.COLORS.codeCyan, C.COLORS.iconTeal, 0.5) : C.COLORS.codeCyan;
  }
  return r < 0.2 ? mix(C.COLORS.dimTeal, C.COLORS.codeCyan, 0.4) : C.COLORS.dimTeal;
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
  blurMul = 1,
): FieldElement => {
  const scale = z * scaleMul * (0.88 + 0.24 * random(id + ':sj'));
  const axisExtent = w0 * scale + h0 * scale * 0.12;
  const {speed, travel, cycles} = wrapFor(z, axisExtent);
  return {
    id,
    kind,
    z,
    scale,
    rot: jitterRot(id + ':rot'),
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
    color: C.COLORS.codeCyan,
    commentColor: C.COLORS.codeWhite,
    lines: [],
    fontPx: C.FONT_PX,
    weight: 400,
    glow: 0,
    streakThickness: 0,
    squareSize: 0,
  };
};

/**
 * Generates the whole element set once. Seeded, so it is identical in every
 * render worker and stable across the entire 540 frames.
 */
export const buildField = (measure: Measure): FieldElement[] => {
  const out: FieldElement[] = [];

  const codePerp = perpSlots('perp:code', C.COUNT_CODE);
  const iconPerp = perpSlots('perp:icon', C.COUNT_ICON);
  const binPerp = perpSlots('perp:bin', C.COUNT_BINARY);
  const streakPerp = perpSlots('perp:streak', C.COUNT_STREAK);
  const accentPerp = perpSlots('perp:accent', C.COUNT_ACCENT);

  // 1. CODE FRAGMENTS ------------------------------------------------------
  for (let i = 0; i < C.COUNT_CODE; i++) {
    const id = `code-${i}`;
    const z = depth(id, 0.18);
    const lines = makeSnippet(id);
    const weight = z > 0.55 ? 500 : 400;
    const w0 = measure(lines, C.FONT_PX, weight);
    const h0 = lines.length * C.FONT_PX * C.LINE_HEIGHT;
    const el = base(id, 'code', z, C.MAX_SCALE, w0, h0, i, C.COUNT_CODE, codePerp[i] as number);
    el.lines = lines;
    el.weight = weight;
    el.color = codeColor(id + ':col', z);
    el.commentColor = lift(el.color, z >= 0.3 ? 0.34 : 0.26);
    el.glow = z >= 0.55 ? 1 : 0.45;
    el.alpha *= 0.82;
    out.push(el);
  }

  // 2. CHATBOT ICONS -------------------------------------------------------
  for (let i = 0; i < C.COUNT_ICON; i++) {
    const id = `icon-${i}`;
    const z = depth(id, 0.2);
    const el = base(id, 'icon', z, C.MAX_SCALE * 0.92, 140, 126, i, C.COUNT_ICON, iconPerp[i] as number);
    el.color =
      z < 0.3
        ? mix(C.COLORS.iconTeal, C.COLORS.dimTeal, 0.6)
        : z > 0.72
          ? lift(C.COLORS.iconTeal, 0.18)
          : C.COLORS.iconTeal;
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
    const el = base(id, 'binary', z, C.MAX_SCALE, w0, h0, i, C.COUNT_BINARY, binPerp[i] as number);
    el.lines = [text];
    el.weight = weight;
    el.color = near
      ? pick(id + ':acc', [C.COLORS.accentYellow, C.COLORS.accentOrange])
      : z < 0.34
        ? C.COLORS.dimTeal
        : mix(C.COLORS.dimTeal, C.COLORS.codeCyan, 0.62);
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
    const el = base(id, 'streak', z, C.MAX_SCALE * 0.8, w0, thickness, i, C.COUNT_STREAK, streakPerp[i] as number, 0.35);
    el.streakThickness = thickness;
    el.color =
      random(id + ':c') < 0.12 ? C.COLORS.codeWhite : mix(C.COLORS.codeCyan, C.COLORS.iconTeal, 0.4);
    el.alpha = rr(id + ':a', 0.05, 0.17);
    el.glow = 0.25;
    out.push(el);
  }

  // 5. ACCENT SQUARES ------------------------------------------------------
  for (let i = 0; i < C.COUNT_ACCENT; i++) {
    const id = `accent-${i}`;
    const z = depth(id, 0.15);
    const size = rint(id + ':sz', 13, 24);
    const el = base(id, 'accent', z, C.MAX_SCALE, size, size, i, C.COUNT_ACCENT, accentPerp[i] as number, 0.35);
    el.squareSize = size;
    el.color = pick(id + ':col', C.ACCENTS);
    el.alpha = Math.min(1, el.alpha * 1.35);
    el.glow = 1.2;
    out.push(el);
  }

  return out;
};
