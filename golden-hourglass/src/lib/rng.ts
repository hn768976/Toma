// Seeded PRNG. Never use Math.random(): every render must be repeatable.
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

export const clamp = (x: number, a = 0, b = 1) => Math.min(b, Math.max(a, x));
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const smoothstep = (a: number, b: number, x: number) => {
  const t = clamp((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};

/** Cubic Hermite interpolation through keyframes [time, value] (C1, non-uniform times). */
export const keyframes = (keys: [number, number][], t: number) => {
  const n = keys.length;
  if (t <= keys[0][0]) return keys[0][1];
  if (t >= keys[n - 1][0]) return keys[n - 1][1];
  let i = 0;
  while (t > keys[i + 1][0]) i++;
  const slope = (a: number, b: number) =>
    (keys[b][1] - keys[a][1]) / (keys[b][0] - keys[a][0]);
  const tan = (k: number) =>
    k === 0 ? slope(0, 1) : k === n - 1 ? slope(n - 2, n - 1) : slope(k - 1, k + 1);
  const h = keys[i + 1][0] - keys[i][0];
  const u = (t - keys[i][0]) / h;
  const u2 = u * u;
  const u3 = u2 * u;
  return (
    (2 * u3 - 3 * u2 + 1) * keys[i][1] +
    (u3 - 2 * u2 + u) * h * tan(i) +
    (-2 * u3 + 3 * u2) * keys[i + 1][1] +
    (u3 - u2) * h * tan(i + 1)
  );
};
