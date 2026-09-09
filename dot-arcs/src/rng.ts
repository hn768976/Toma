// Deterministic helpers. Nothing here may be called at render time with a
// changing seed — the layout is built once, at module scope.

export const mulberry32 = (seed: number) => {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

export const clamp = (v: number, lo: number, hi: number) =>
  v < lo ? lo : v > hi ? hi : v;

export const smoothstep = (edge0: number, edge1: number, x: number) => {
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
};

export const smootherstep = (edge0: number, edge1: number, x: number) => {
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * t * (t * (t * 6 - 15) + 10);
};

/**
 * Smooth 1-D value noise over an integer index (used for per-arc drift, so
 * neighbouring arcs stay correlated instead of each doing its own thing).
 * `wavelength` is measured in index steps.
 */
export const makeIndexNoise = (
  seed: number,
  count: number,
  wavelength: number,
) => {
  const rand = mulberry32(seed);
  const n = Math.max(2, Math.ceil(count / wavelength) + 3);
  const knots = new Float64Array(n);
  for (let i = 0; i < n; i++) knots[i] = rand() * 2 - 1;
  return (i: number) => {
    const x = i / wavelength;
    const i0 = Math.floor(x);
    const f = x - i0;
    const a = knots[(i0 + n) % n];
    const b = knots[(i0 + 1 + n) % n];
    const c = knots[(i0 + 2 + n) % n];
    const d = knots[(i0 + 3 + n) % n];
    // Catmull-Rom, so the field is C1 and reads as a drift rather than steps.
    const t = f;
    const t2 = t * t;
    const t3 = t2 * t;
    return (
      0.5 *
      (2 * b +
        (-a + c) * t +
        (2 * a - 5 * b + 4 * c - d) * t2 +
        (-a + 3 * b - 3 * c + d) * t3)
    );
  };
};
