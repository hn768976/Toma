/**
 * Seeded random numbers. Nothing in this project may call Math.random():
 * every "random" layout value comes from a mulberry32 stream that is seeded
 * at module level, so each render of a frame is identical.
 */
export const mulberry32 = (seed: number) => {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

export class Rng {
  private readonly f: () => number;
  constructor(seed: number) {
    this.f = mulberry32(seed);
  }
  /** 0 <= x < 1 */
  next(): number {
    return this.f();
  }
  range(a: number, b: number): number {
    return a + (b - a) * this.f();
  }
  /** integer in [a, b] inclusive */
  int(a: number, b: number): number {
    return a + Math.floor(this.f() * (b - a + 1));
  }
  pick<T>(arr: readonly T[]): T {
    return arr[Math.floor(this.f() * arr.length)];
  }
  chance(p: number): boolean {
    return this.f() < p;
  }
  sign(): number {
    return this.f() < 0.5 ? -1 : 1;
  }
}

/* ---- small frame-driven easing helpers (pure functions of their input) --- */
export const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const smooth = (t: number) => {
  const x = clamp01(t);
  return x * x * (3 - 2 * x);
};
export const smoother = (t: number) => {
  const x = clamp01(t);
  return x * x * x * (x * (x * 6 - 15) + 10);
};
/** 0 before a, 1 after b, eased in between */
export const ramp = (x: number, a: number, b: number, ease = smooth) =>
  ease((x - a) / (b - a));
export const easeOutCubic = (t: number) => 1 - Math.pow(1 - clamp01(t), 3);
export const easeInCubic = (t: number) => Math.pow(clamp01(t), 3);
export const easeInOutCubic = (t: number) => {
  const x = clamp01(t);
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
};
/** piecewise-linear keyframes: [[time, value], ...] with optional easing */
export const keys = (
  t: number,
  k: readonly (readonly [number, number])[],
  ease: (x: number) => number = smooth,
) => {
  if (t <= k[0][0]) return k[0][1];
  for (let i = 1; i < k.length; i++) {
    if (t <= k[i][0]) {
      const u = (t - k[i - 1][0]) / (k[i][0] - k[i - 1][0]);
      return lerp(k[i - 1][1], k[i][1], ease(u));
    }
  }
  return k[k.length - 1][1];
};

/**
 * Monotone cubic (PCHIP) interpolation through keyframes [[t, v], ...].
 * Smooth, and never overshoots between keys - used for camera paths.
 */
export const pchip = (t: number, k: readonly (readonly [number, number])[]) => {
  const n = k.length;
  if (t <= k[0][0]) return k[0][1];
  if (t >= k[n - 1][0]) return k[n - 1][1];
  const h: number[] = [];
  const d: number[] = [];
  for (let i = 0; i < n - 1; i++) {
    h.push(k[i + 1][0] - k[i][0]);
    d.push((k[i + 1][1] - k[i][1]) / h[i]);
  }
  const m: number[] = new Array(n).fill(0);
  m[0] = d[0];
  m[n - 1] = d[n - 2];
  for (let i = 1; i < n - 1; i++) {
    if (d[i - 1] * d[i] <= 0) m[i] = 0;
    else {
      const w1 = 2 * h[i] + h[i - 1];
      const w2 = h[i] + 2 * h[i - 1];
      m[i] = (w1 + w2) / (w1 / d[i - 1] + w2 / d[i]);
    }
  }
  let i = 0;
  while (i < n - 2 && t > k[i + 1][0]) i++;
  const x = (t - k[i][0]) / h[i];
  const x2 = x * x;
  const x3 = x2 * x;
  return (
    (2 * x3 - 3 * x2 + 1) * k[i][1] +
    (x3 - 2 * x2 + x) * h[i] * m[i] +
    (-2 * x3 + 3 * x2) * k[i + 1][1] +
    (x3 - x2) * h[i] * m[i + 1]
  );
};
