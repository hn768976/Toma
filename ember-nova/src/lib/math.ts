// Small deterministic math helpers shared by the scene code.

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

export const clamp = (v: number, lo = 0, hi = 1) =>
  Math.min(hi, Math.max(lo, v));
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const smoothstep = (e0: number, e1: number, x: number) => {
  const t = clamp((x - e0) / (e1 - e0));
  return t * t * (3 - 2 * t);
};
export const easeOutCubic = (t: number) => 1 - Math.pow(1 - clamp(t), 3);
export const easeInOutSine = (t: number) => -(Math.cos(Math.PI * clamp(t)) - 1) / 2;

/** Piecewise-linear envelope through [time, value] pairs (smoothstepped). */
export const envelope = (pairs: [number, number][], t: number) => {
  if (t <= pairs[0][0]) return pairs[0][1];
  for (let i = 1; i < pairs.length; i++) {
    const [t1, v1] = pairs[i];
    const [t0, v0] = pairs[i - 1];
    if (t <= t1) return lerp(v0, v1, smoothstep(t0, t1, t));
  }
  return pairs[pairs.length - 1][1];
};

export type Key = [t: number, x: number, y: number];

/**
 * Cubic Hermite spline through timed 2D keys (Catmull-Rom style tangents
 * that respect uneven key spacing). Returns [x, y]; clamps outside range.
 */
export const sampleKeys = (keys: Key[], t: number): [number, number] => {
  const n = keys.length;
  if (t <= keys[0][0]) return [keys[0][1], keys[0][2]];
  if (t >= keys[n - 1][0]) return [keys[n - 1][1], keys[n - 1][2]];
  let i = 0;
  while (i < n - 2 && t > keys[i + 1][0]) i++;
  const k0 = keys[Math.max(0, i - 1)];
  const k1 = keys[i];
  const k2 = keys[i + 1];
  const k3 = keys[Math.min(n - 1, i + 2)];
  const dt = k2[0] - k1[0];
  const u = (t - k1[0]) / dt;
  const tan = (a: Key, b: Key, axis: 1 | 2) =>
    b[0] === a[0] ? 0 : ((b[axis] - a[axis]) / (b[0] - a[0])) * dt;
  const h00 = 2 * u ** 3 - 3 * u ** 2 + 1;
  const h10 = u ** 3 - 2 * u ** 2 + u;
  const h01 = -2 * u ** 3 + 3 * u ** 2;
  const h11 = u ** 3 - u ** 2;
  const out: [number, number] = [0, 0];
  for (const axis of [1, 2] as const) {
    const m1 = tan(k0, k2, axis);
    const m2 = tan(k1, k3, axis);
    out[axis - 1] = h00 * k1[axis] + h10 * m1 + h01 * k2[axis] + h11 * m2;
  }
  return out;
};
