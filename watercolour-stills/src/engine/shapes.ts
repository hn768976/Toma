// Organic outline generators. Every shape is a closed polygon whose edge is
// pushed around by seeded fractal noise; p5.brush's bleed then frays it
// further, so nothing ends up geometric or symmetrical.
import type { Noise, Rng } from "./rng";

export type Pt = [number, number];

export type BlobOpts = {
  /** number of vertices before p5.brush subdivides them */
  n?: number;
  /** 0..1, how far the radius wanders */
  irregular?: number;
  /** noise frequency around the outline (higher = more lobes) */
  freq?: number;
  rot?: number;
};

export const blob = (
  rng: Rng,
  noise: Noise,
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  { n = 110, irregular = 0.3, freq = 1.6, rot = rng.range(0, Math.PI * 2) }: BlobOpts = {},
): Pt[] => {
  const ox = rng.range(0, 200);
  const oy = rng.range(0, 200);
  const cr = Math.cos(rot);
  const sr = Math.sin(rot);
  const pts: Pt[] = [];
  const phase = rng.range(0, Math.PI * 2);
  for (let i = 0; i < n; i++) {
    const a = phase + (i / n) * Math.PI * 2 + rng.range(-0.25, 0.25) / n;
    // broad lobes plus a finer ripple so low-bleed edges are not faceted
    const k =
      1 +
      irregular * 1.6 * noise.fbm(ox + Math.cos(a) * freq, oy + Math.sin(a) * freq, 3) +
      0.014 * noise.fbm(ox + Math.cos(a) * freq * 7, oy + Math.sin(a) * freq * 7, 2) +
      rng.range(-0.006, 0.006);
    const x = Math.cos(a) * rx * k;
    const y = Math.sin(a) * ry * k;
    pts.push([cx + x * cr - y * sr, cy + x * sr + y * cr]);
  }
  return pts;
};

/** A polygon around a centre line with a varying half-width. */
export const ribbon = (
  center: Pt[],
  halfWidth: (t: number, i: number) => number,
): Pt[] => {
  const left: Pt[] = [];
  const right: Pt[] = [];
  for (let i = 0; i < center.length; i++) {
    const a = center[Math.max(0, i - 1)];
    const b = center[Math.min(center.length - 1, i + 1)];
    let dx = b[0] - a[0];
    let dy = b[1] - a[1];
    const len = Math.hypot(dx, dy) || 1;
    dx /= len;
    dy /= len;
    const w = halfWidth(i / (center.length - 1), i);
    left.push([center[i][0] - dy * w, center[i][1] + dx * w]);
    right.push([center[i][0] + dy * w, center[i][1] - dx * w]);
  }
  return [...left, ...right.reverse()];
};

/**
 * A loose horizontal band whose top and bottom edges wander independently.
 * x0..x1 may run past the sheet so the band bleeds off both sides.
 */
export const band = (
  rng: Rng,
  noise: Noise,
  x0: number,
  x1: number,
  yTop: number,
  yBottom: number,
  { n = 28, wobble = 40, freq = 3 } = {},
): Pt[] => {
  const ot = rng.range(0, 300);
  const ob = rng.range(0, 300);
  const top: Pt[] = [];
  const bot: Pt[] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const x = x0 + (x1 - x0) * t + rng.range(-0.3, 0.3) * ((x1 - x0) / n);
    top.push([x, yTop + wobble * noise.fbm(ot + t * freq, 0.5, 3) * 2]);
    bot.push([x, yBottom + wobble * noise.fbm(ob + t * freq, 3.5, 3) * 2]);
  }
  return [...top, ...bot.reverse()];
};

/** A wandering polyline, used as the centre line of drips, runs and strokes. */
export const wander = (
  rng: Rng,
  noise: Noise,
  x: number,
  y: number,
  angle: number,
  length: number,
  steps: number,
  curl = 0.3,
): Pt[] => {
  const pts: Pt[] = [[x, y]];
  const o = rng.range(0, 500);
  let a = angle;
  const step = length / steps;
  for (let i = 0; i < steps; i++) {
    a = angle + curl * noise.fbm(o + i * 0.15, 1.7, 2) * 2;
    x += Math.cos(a) * step;
    y += Math.sin(a) * step;
    pts.push([x, y]);
  }
  return pts;
};

export const translate = (pts: Pt[], dx: number, dy: number): Pt[] =>
  pts.map(([x, y]) => [x + dx, y + dy]);

export const scaleAbout = (pts: Pt[], cx: number, cy: number, s: number): Pt[] =>
  pts.map(([x, y]) => [cx + (x - cx) * s, cy + (y - cy) * s]);

/**
 * A path that follows a smooth noise flow field, for marbled swirls.
 * `swirl` is how many radians the field turns across its noise scale.
 */
export const flowPath = (
  noise: Noise,
  x: number,
  y: number,
  length: number,
  step: number,
  { angle = 0, swirl = 2.4, scale = 900, salt = 0 } = {},
): Pt[] => {
  const pts: Pt[] = [[x, y]];
  for (let d = 0; d < length; d += step) {
    const a = angle + swirl * noise.fbm(salt + x / scale, salt * 0.7 + y / scale, 3) * 2;
    x += Math.cos(a) * step;
    y += Math.sin(a) * step;
    pts.push([x, y]);
  }
  return pts;
};

/** Shuffle in place with a seeded rng. */
export const shuffle = <T>(rng: Rng, arr: T[]): T[] => {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
};
