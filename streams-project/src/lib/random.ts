// Seeded PRNG. Only ever called at module level / in one-time builders,
// never per frame, so every render thread produces identical data.
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

export type Rng = ReturnType<typeof mulberry32>;

export const range = (rng: Rng, a: number, b: number) => a + (b - a) * rng();

export const pick = <T,>(rng: Rng, weights: [T, number][]): T => {
  const total = weights.reduce((s, w) => s + w[1], 0);
  let r = rng() * total;
  for (const [v, w] of weights) {
    r -= w;
    if (r <= 0) return v;
  }
  return weights[weights.length - 1][0];
};

export const TAU = Math.PI * 2;

// Smooth closed loop helpers: t in [0,1) over the loop.
export const loopT = (frame: number, period: number) =>
  (((frame % period) + period) % period) / period;

export const easeInOut = (x: number) => {
  const t = Math.min(1, Math.max(0, x));
  return t * t * (3 - 2 * t);
};
export const easeInOutCubic = (x: number) => {
  const t = Math.min(1, Math.max(0, x));
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
};
