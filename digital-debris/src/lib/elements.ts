import { BUCKETS, depthOf, swayAmpX } from "./depth";
import { biased, clamp, clamp01, mulberry32, pick, range, weightedIndex, type Rng } from "./random";

export type Kind = "dash" | "trace" | "bar" | "point" | "bracket";

/** Axis-aligned rectangle in unit space (1 unit = the base element size). */
export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Wobble {
  ax: number;
  ay: number;
  kx: number;
  ky: number;
  px: number;
  py: number;
}

export interface Flicker {
  period: number;
  duty: number;
  phase: number;
}

export interface Pulse {
  k: number;
  phase: number;
  amt: number;
}

export interface Debris {
  bucket: number;
  kind: Kind;
  /** Geometry, already centred on its own bounding box. */
  rects: Rect[];
  /** Non-zero for `point` elements drawn as discs. */
  circleR: number;
  /** Per-element size jitter on top of the bucket's depth scale. */
  unitScale: number;
  /** Position of the sprite centre, in fractions of frame width / height. */
  nx: number;
  ny: number;
  /** Ramp position in [0, 1]; ignored when `accent >= 0`. */
  colorT: number;
  /** Index into the palette accents, or -1 for the main ramp. */
  accent: number;
  alphaJitter: number;
  wobble: [Wobble, Wobble];
  flicker: Flicker | null;
  pulse: Pulse | null;
}

/** Type mix. This blend is what makes the field read as debris, not bokeh. */
const KIND_WEIGHTS: Record<Kind, number> = {
  dash: 40,
  trace: 20,
  bar: 15,
  point: 20,
  bracket: 5,
};
const KINDS = Object.keys(KIND_WEIGHTS) as Kind[];
const KIND_W = KINDS.map((k) => KIND_WEIGHTS[k]);

/** More elements in the sharp mid band than in the heavy near layers. */
const BUCKET_WEIGHTS = [13, 15, 17, 17, 14, 10, 8, 6];

/** Periods must divide 600 exactly so every path closes on the loop point. */
const WOBBLE_HARMONICS = [1, 2, 3, 4, 5, 6] as const;
const FLICKER_PERIODS = [50, 60, 75, 100, 120, 150, 200, 300] as const;

export const TOTAL_ELEMENTS = 1200;

const centreRects = (rects: Rect[]) => {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const r of rects) {
    minX = Math.min(minX, r.x);
    minY = Math.min(minY, r.y);
    maxX = Math.max(maxX, r.x + r.w);
    maxY = Math.max(maxY, r.y + r.h);
  }
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  for (const r of rects) {
    r.x -= cx;
    r.y -= cy;
  }
  return rects;
};

const makeDash = (rng: Rng, d: number): Rect[] => {
  // A small share are the long hairlines that give the field its scale. They
  // belong to the far and mid layers: up close they would become columns.
  const long = rng() < (d < 0.55 ? 0.12 : 0.015);
  const len = long ? range(rng, 4.5, 12) : biased(rng, 0.5, 3.0, 1.8);
  const thick = long ? range(rng, 0.045, 0.075) : range(rng, 0.085, 0.2);
  return rng() < 0.62
    ? [{ x: -len / 2, y: -thick / 2, w: len, h: thick }]
    : [{ x: -thick / 2, y: -len / 2, w: thick, h: len }];
};

const makeTrace = (rng: Rng): Rect[] => {
  const t = range(rng, 0.06, 0.12);
  const a = biased(rng, 0.6, 3.0, 1.4) * (rng() < 0.5 ? 1 : -1);
  const b = biased(rng, 0.5, 2.4, 1.4) * (rng() < 0.5 ? 1 : -1);
  const rects: Rect[] = [
    { x: Math.min(0, a), y: -t / 2, w: Math.abs(a) + t, h: t },
    { x: a - t / 2, y: Math.min(0, b), w: t, h: Math.abs(b) + t },
  ];
  // Two thirds get a second bend, so the fragment reads as torn-out routing.
  if (rng() < 0.66) {
    const c = biased(rng, 0.5, 2.2, 1.4) * (rng() < 0.5 ? 1 : -1);
    rects.push({ x: a + Math.min(0, c), y: b - t / 2, w: Math.abs(c) + t, h: t });
  }
  return centreRects(rects);
};

const makeBar = (rng: Rng): Rect[] => {
  const len = range(rng, 0.55, 1.7);
  const thick = range(rng, 0.26, 0.5);
  return rng() < 0.78
    ? [{ x: -len / 2, y: -thick / 2, w: len, h: thick }]
    : [{ x: -thick / 2, y: -len / 2, w: thick, h: len }];
};

const makeBracket = (rng: Rng): Rect[] => {
  const s = range(rng, 0.7, 1.9);
  const h = s * range(rng, 0.6, 1.1);
  const t = range(rng, 0.07, 0.12);
  const variant = weightedIndex(rng, [5, 3, 2]);
  const rects: Rect[] = [
    { x: 0, y: 0, w: s, h: t },
    { x: 0, y: 0, w: t, h },
  ];
  if (variant >= 1) rects.push({ x: 0, y: h - t, w: s, h: t });
  if (variant >= 2) rects.push({ x: s - t, y: 0, w: t, h });
  return centreRects(rects);
};

const makeWobble = (rng: Rng, scale: number): Wobble => ({
  ax: range(rng, 0.15, 1) * scale,
  ay: range(rng, 0.15, 1) * scale * 0.8,
  kx: pick(rng, WOBBLE_HARMONICS),
  ky: pick(rng, WOBBLE_HARMONICS),
  px: rng() * Math.PI * 2,
  py: rng() * Math.PI * 2,
});

/** Box-Muller, so clusters fall off smoothly rather than in hard discs. */
const gaussian = (rng: Rng) =>
  Math.sqrt(-2 * Math.log(1 - rng())) * Math.cos(2 * Math.PI * rng());

const CLUSTERS = 14;

export const generateElements = (seed: number): Debris[] => {
  const rng = mulberry32(seed);
  const out: Debris[] = [];

  // Loose density variation. A perfectly even scatter reads as wallpaper; the
  // clusters are weak enough that no one spot pulls the eye.
  const clusters = Array.from({ length: CLUSTERS }, () => ({
    x: range(rng, -0.1, 1.1),
    y: range(rng, -0.05, 1.05),
    spread: range(rng, 0.07, 0.19),
  }));

  for (let i = 0; i < TOTAL_ELEMENTS; i++) {
    const bucket = weightedIndex(rng, BUCKET_WEIGHTS);
    const d = depthOf(bucket);
    const kind = KINDS[weightedIndex(rng, KIND_W)];

    let rects: Rect[] = [];
    let circleR = 0;
    if (kind === "dash") rects = makeDash(rng, d);
    else if (kind === "trace") rects = makeTrace(rng);
    else if (kind === "bar") rects = makeBar(rng);
    else if (kind === "bracket") rects = makeBracket(rng);
    else if (rng() < 0.35) {
      const s = range(rng, 0.1, 0.2);
      rects = [{ x: -s / 2, y: -s / 2, w: s, h: s }];
    } else {
      circleR = range(rng, 0.07, 0.155);
    }

    // Spawn margin only has to cover this bucket's own sway, so the far
    // layers spend nearly all their elements on screen.
    const marginX = 0.03 + swayAmpX(d) * 1.35;
    const marginY = 0.05;

    let nx: number;
    let ny: number;
    if (rng() < 0.45) {
      const c = clusters[Math.floor(rng() * CLUSTERS) % CLUSTERS];
      nx = clamp(c.x + gaussian(rng) * c.spread, -marginX, 1 + marginX);
      ny = clamp(c.y + gaussian(rng) * c.spread * 0.8, -marginY, 1 + marginY);
    } else {
      nx = range(rng, -marginX, 1 + marginX);
      ny = range(rng, -marginY, 1 + marginY);
    }

    // Bars carry the accent colours; a few other fragments join them so the
    // punctuation is not perfectly correlated with one shape.
    const accentRoll = kind === "bar" ? true : rng() < 0.02;

    // The sharp mid band gets the brightest ramp positions.
    const brightBias = 1 - Math.abs(d - 0.52) / 0.52;
    const colorT = clamp01(0.06 + 0.68 * Math.pow(rng(), 1.35) + 0.4 * brightBias * rng());

    out.push({
      bucket,
      kind,
      rects,
      circleR,
      unitScale: range(rng, 0.72, 1.4) * (d > 0.5 ? 1 - 0.28 * (d - 0.5) * 2 : 1),
      nx,
      ny,
      colorT,
      accent: accentRoll ? Math.floor(rng() * 3) % 3 : -1,
      alphaJitter: range(rng, 0.62, 1.25),
      wobble: [makeWobble(rng, 0.016), makeWobble(rng, 0.007)],
      flicker:
        rng() < 0.085
          ? {
              period: pick(rng, FLICKER_PERIODS),
              duty: range(rng, 0.45, 0.88),
              phase: Math.floor(rng() * 600),
            }
          : null,
      pulse:
        rng() < 0.16
          ? { k: rng() < 0.6 ? 1 : 2, phase: rng() * Math.PI * 2, amt: range(rng, 0.2, 0.5) }
          : null,
    });
  }

  // Back to front, so the near blurred layers sit over the sharp mid band.
  out.sort((a, b) => a.bucket - b.bucket);
  return out;
};

/** Index of the first element of each bucket, plus a terminator. */
export const bucketOffsets = (els: Debris[]) => {
  const offsets = new Array<number>(BUCKETS + 1).fill(els.length);
  offsets[0] = 0;
  let bucket = 0;
  for (let i = 0; i < els.length; i++) {
    while (els[i].bucket > bucket) {
      bucket++;
      offsets[bucket] = i;
    }
  }
  for (let b = bucket + 1; b <= BUCKETS; b++) offsets[b] = els.length;
  return offsets;
};
