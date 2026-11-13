/** Small deterministic helpers. Nothing here may depend on wall-clock time. */

export const clamp = (x: number, a: number, b: number) =>
  Math.min(b, Math.max(a, x));

export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

export const smoothstep = (a: number, b: number, x: number) => {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};

/** Mulberry32 – a tiny seeded PRNG, so every render is reproducible. */
export const makeRng = (seed: number) => {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

/** Positive modulo. */
export const wrap = (x: number, lo: number, hi: number) => {
  const r = hi - lo;
  return lo + ((((x - lo) % r) + r) % r);
};

/** Catmull-Rom interpolation through uniformly spaced samples. */
export const sampleSeries = (
  series: ReadonlyArray<number>,
  index: number,
): number => {
  const n = series.length;
  const x = clamp(index, 0, n - 1);
  const i1 = Math.min(Math.floor(x), n - 2);
  const t = x - i1;
  const p0 = series[Math.max(i1 - 1, 0)];
  const p1 = series[i1];
  const p2 = series[i1 + 1];
  const p3 = series[Math.min(i1 + 2, n - 1)];
  return (
    0.5 *
    (2 * p1 +
      (-p0 + p2) * t +
      (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t +
      (-p0 + 3 * p1 - 3 * p2 + p3) * t * t * t)
  );
};
