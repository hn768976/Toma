import { Easing } from 'remotion';

export type EaseFn = (t: number) => number;

export const ease = {
  inOut: Easing.bezier(0.45, 0, 0.55, 1),
  out: Easing.bezier(0.2, 0.75, 0.34, 0.94),
  soft: Easing.bezier(0.0, 0.65, 0.51, 0.99),
  in: Easing.bezier(0.6, 0.02, 0.9, 0.5),
  snap: Easing.bezier(0.1, 0.9, 0.2, 1),
  fall: Easing.bezier(0.55, 0, 0.9, 0.6),
  rise: Easing.bezier(0.2, 0.6, 0.35, 1),
  hold: () => 0,
} satisfies Record<string, EaseFn>;

export type Key = [frame: number, value: number, easeOut?: EaseFn];

/**
 * Piecewise keyframe track. Each key's easing shapes the segment that LEAVES it.
 * Clamped outside the first/last key.
 */
export const track = (f: number, keys: Key[]): number => {
  if (f <= keys[0][0]) return keys[0][1];
  for (let k = 0; k < keys.length - 1; k++) {
    const [t0, v0, e] = keys[k];
    const [t1, v1] = keys[k + 1];
    if (f <= t1) {
      const p = t1 === t0 ? 1 : (f - t0) / (t1 - t0);
      return v0 + (v1 - v0) * (e ?? ease.inOut)(p);
    }
  }
  return keys[keys.length - 1][1];
};

export const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

/** Volume-preserving squash: given vertical stretch factor returns [sx, sy] with sx*sy = 1. */
export const squash = (sy: number): [number, number] => [1 / sy, sy];

/**
 * Blink amount 0 (open) .. 1 (closed). Close over 2 frames, hold 1, open over 2.
 */
export const blinkAt = (f: number, starts: number[]): number => {
  let b = 0;
  for (const s of starts) {
    const d = f - s;
    if (d < 0 || d > 5) continue;
    if (d <= 2) b = Math.max(b, ease.in(d / 2));
    else if (d <= 3) b = 1;
    else b = Math.max(b, 1 - ease.out((d - 3) / 2));
  }
  return b;
};

/** Idle breathing scale, ±amp around 1. */
export const breathe = (f: number, phase = 0, amp = 0.015, period = 56) =>
  1 + amp * Math.sin((f / period) * Math.PI * 2 + phase);

export const wave = (f: number, hz: number, phase = 0, fps = 30) =>
  Math.sin((f / fps) * hz * Math.PI * 2 + phase);

/** Deterministic PRNG (mulberry32). */
export const seeded = (seed: number) => {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

/** Letter-style pop: 0 -> 1.15 -> 0.95 -> 1. Returns scale. */
export const popScale = (f: number, start: number) =>
  track(f, [
    [start, 0, ease.out],
    [start + 5, 1.15, ease.inOut],
    [start + 9, 0.95, ease.inOut],
    [start + 13, 1.02, ease.inOut],
    [start + 17, 1],
  ]);

// ---- 2D affine matrices [a, b, c, d, e, f] (SVG / Pixi order) ----
export type Mat = [number, number, number, number, number, number];
export const I: Mat = [1, 0, 0, 1, 0, 0];
export const mul = (m: Mat, n: Mat): Mat => [
  m[0] * n[0] + m[2] * n[1],
  m[1] * n[0] + m[3] * n[1],
  m[0] * n[2] + m[2] * n[3],
  m[1] * n[2] + m[3] * n[3],
  m[0] * n[4] + m[2] * n[5] + m[4],
  m[1] * n[4] + m[3] * n[5] + m[5],
];
export const T = (x: number, y: number): Mat => [1, 0, 0, 1, x, y];
export const S = (x: number, y = x): Mat => [x, 0, 0, y, 0, 0];
export const R = (deg: number): Mat => {
  const r = (deg * Math.PI) / 180;
  return [Math.cos(r), Math.sin(r), -Math.sin(r), Math.cos(r), 0, 0];
};
export const chain = (...ms: Mat[]) => ms.reduce((acc, m) => mul(acc, m), I);
export const apply = (m: Mat, x: number, y: number): [number, number] => [
  m[0] * x + m[2] * y + m[4],
  m[1] * x + m[3] * y + m[5],
];
export const svgMat = (m: Mat) => `matrix(${m.map((v) => v.toFixed(4)).join(' ')})`;
