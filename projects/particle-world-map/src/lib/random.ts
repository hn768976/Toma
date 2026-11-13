// Deterministic helpers: every value in the composition is a pure function of
// a seed and the current frame, so renders are identical across machines,
// render tabs and re-renders.

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

/** Stable hash -> [0,1) for integer inputs (used for per-element flicker). */
export const hash01 = (n: number) => {
  let x = Math.imul((n | 0) ^ 0x9e3779b9, 0x85ebca6b);
  x ^= x >>> 13;
  x = Math.imul(x, 0xc2b2ae35);
  x ^= x >>> 16;
  return (x >>> 0) / 4294967296;
};

export const clamp = (v: number, lo: number, hi: number) =>
  Math.min(hi, Math.max(lo, v));

export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

export const smoothstep = (e0: number, e1: number, x: number) => {
  const t = clamp((x - e0) / (e1 - e0), 0, 1);
  return t * t * (3 - 2 * t);
};

/** 1D value noise, smooth, deterministic. */
export const noise1 = (x: number, seed = 0) => {
  const i = Math.floor(x);
  const f = x - i;
  const a = hash01(i * 7919 + seed * 104729);
  const b = hash01((i + 1) * 7919 + seed * 104729);
  const u = f * f * (3 - 2 * f);
  return a + (b - a) * u;
};

/** Centripetal-free uniform Catmull-Rom through keyframes (t sorted). */
export const spline = (keys: ReadonlyArray<readonly [number, number]>, t: number) => {
  if (t <= keys[0][0]) return keys[0][1];
  const last = keys[keys.length - 1];
  if (t >= last[0]) return last[1];
  let i = 0;
  while (i < keys.length - 2 && t > keys[i + 1][0]) i++;
  const p0 = keys[Math.max(0, i - 1)][1];
  const p1 = keys[i][1];
  const p2 = keys[i + 1][1];
  const p3 = keys[Math.min(keys.length - 1, i + 2)][1];
  const u = (t - keys[i][0]) / (keys[i + 1][0] - keys[i][0]);
  const u2 = u * u;
  const u3 = u2 * u;
  return (
    0.5 *
    (2 * p1 +
      (-p0 + p2) * u +
      (2 * p0 - 5 * p1 + 4 * p2 - p3) * u2 +
      (-p0 + 3 * p1 - 3 * p2 + p3) * u3)
  );
};
