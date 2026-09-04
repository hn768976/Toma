import { clamp, lerp } from "./rng";

/** Number of quantised hue buckets. Draws are batched per bucket so the whole
 *  board is stroked in ~150 paths instead of one style change per segment. */
export const HUE_BUCKETS = 48;

/** Steps along a pulse tail. Colours for every (bucket, step) pair are baked
 *  into a lookup table once, so no colour strings are built during a frame. */
export const TAIL_STEPS = 26;

type HueStop = readonly [pos: number, hue: number];

export type Palette = {
  readonly id: string;
  /** Page/board background. */
  readonly bg: string;
  /** Dark "solder mask relief" stroked under every trace. */
  readonly relief: string;
  readonly hueStops: readonly HueStop[];
  /** How much the hue shifts between the top and the bottom of the board. */
  readonly hueTilt: number;
  readonly sat: number;
  /** Lightness of an unlit trace, as a percentage. */
  readonly baseL: number;
  readonly baseSat: number;
  /** Lightness of an unlit component outline. */
  readonly partL: number;
  /** Head lightness/saturation of a pulse (near-white when sat is low). */
  readonly headL: number;
  readonly headS: number;
  /** Tail-tip lightness/saturation, where the pulse settles into trace hue. */
  readonly tailL: number;
  readonly tailS: number;
  /** Fraction of pulses rendered as pale-white "hot" runs. */
  readonly whitePulses: number;
  readonly vignette: number;
  /** Hue range of the substrate mottling, kept inside the palette family. */
  readonly substrate: readonly [number, number];
};

export const V1_NEON: Palette = {
  id: "neon",
  bg: "#04060c",
  relief: "#070b16",
  // green #22e07a -> cyan #22d3ee -> magenta #e026c0 -> violet #7a3ce8
  hueStops: [
    [0.0, 146],
    [0.26, 168],
    [0.5, 192],
    [0.63, 224],
    [0.8, 300],
    [1.0, 274],
  ],
  hueTilt: 22,
  sat: 82,
  baseL: 11,
  baseSat: 62,
  partL: 15,
  headL: 97,
  headS: 16,
  tailL: 48,
  tailS: 92,
  whitePulses: 0.06,
  vignette: 0.62,
  substrate: [205, 315],
};

export const V2_AMBER: Palette = {
  id: "amber",
  bg: "#05040a",
  relief: "#0d0904",
  // amber #f0a028 -> gold #ffd27a, unlit traces sit near #8a4a10
  hueStops: [
    [0.0, 28],
    [0.5, 36],
    [1.0, 44],
  ],
  hueTilt: 7,
  sat: 88,
  baseL: 13,
  baseSat: 74,
  partL: 17,
  headL: 98,
  headS: 10,
  tailL: 50,
  tailS: 95,
  whitePulses: 0.16,
  vignette: 0.66,
  substrate: [18, 44],
};

const ASPECT_FOR_TILT = 0.5625;

/** Hue at a point on the board. Horizontal position dominates; a small
 *  vertical tilt keeps the right-hand side from reading as one flat colour. */
export const hueAt = (p: Palette, x: number, y: number): number => {
  const stops = p.hueStops;
  const xc = clamp(x, 0, 1);
  let h = stops[stops.length - 1][1];
  for (let i = 0; i < stops.length - 1; i++) {
    const [x0, h0] = stops[i];
    const [x1, h1] = stops[i + 1];
    if (xc <= x1 || i === stops.length - 2) {
      h = lerp(h0, h1, clamp((xc - x0) / (x1 - x0), 0, 1));
      break;
    }
  }
  return h + (clamp(y / ASPECT_FOR_TILT, 0, 1) - 0.5) * p.hueTilt;
};

export const bucketOf = (p: Palette, x: number, y: number): number =>
  clamp(
    Math.round(((hueAt(p, x, y) + 720) % 360 / 360) * HUE_BUCKETS) % HUE_BUCKETS,
    0,
    HUE_BUCKETS - 1,
  );

const hueOfBucket = (b: number): number => (b / HUE_BUCKETS) * 360;

/**
 * Blues and violets read much darker than greens and yellows at the same HSL
 * lightness, which would leave the right-hand side of the board looking unlit.
 * Nudge lightness back up across that band so the unlit routing stays legible
 * at a constant apparent brightness.
 */
const lumaFix = (h: number): number => {
  const d = Math.abs(((h - 258 + 540) % 360) - 180); // distance from hue 258
  return 1 + 0.5 * Math.max(0, 1 - d / 95);
};

const hsl = (h: number, s: number, l: number, a = 1): string =>
  a >= 1
    ? `hsl(${h.toFixed(1)},${s.toFixed(1)}%,${l.toFixed(1)}%)`
    : `hsla(${h.toFixed(1)},${s.toFixed(1)}%,${l.toFixed(1)}%,${a.toFixed(4)})`;

export type PaletteLuts = {
  /** Unlit trace colour per hue bucket. */
  base: string[];
  /** Unlit component-outline colour per hue bucket. */
  part: string[];
  /** [bucket][step] pulse colour, step 0 = head. Includes tail alpha. */
  tail: string[][];
  /** Pale-white pulse variant, same step layout. */
  whiteTail: string[];
  /** Component flash colour per bucket, at full alpha. */
  flash: string[];
};

export const buildLuts = (p: Palette): PaletteLuts => {
  const base: string[] = [];
  const part: string[] = [];
  const tail: string[][] = [];
  const flash: string[] = [];

  for (let b = 0; b < HUE_BUCKETS; b++) {
    const h = hueOfBucket(b);
    const fix = lumaFix(h);
    base.push(hsl(h, p.baseSat, p.baseL * fix));
    part.push(hsl(h, p.baseSat * 0.9, p.partL * fix));
    flash.push(hsl(h, 40, 88));

    const steps: string[] = [];
    for (let i = 0; i < TAIL_STEPS; i++) {
      const u = i / (TAIL_STEPS - 1); // 0 at the head, 1 at the tail tip
      const l = lerp(p.headL, p.tailL * Math.min(1.25, fix), Math.pow(u, 0.55));
      const s = lerp(p.headS, p.tailS, Math.pow(u, 0.45));
      const a = Math.pow(1 - u, 1.75);
      steps.push(hsl(h, s, l, a));
    }
    tail.push(steps);
  }

  const whiteTail: string[] = [];
  for (let i = 0; i < TAIL_STEPS; i++) {
    const u = i / (TAIL_STEPS - 1);
    const l = lerp(99, 74, Math.pow(u, 0.6));
    const s = lerp(0, 34, u);
    const a = Math.pow(1 - u, 1.75);
    whiteTail.push(hsl(46, s, l, a));
  }

  return { base, part, tail, whiteTail, flash };
};
