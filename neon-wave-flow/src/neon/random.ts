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

export const range = (rng: Rng, min: number, max: number) =>
  min + (max - min) * rng();

// Smooth 1D noise in [-1, 1] built from a few incommensurate sines; cheap,
// deterministic and continuous in both x and t.
export const wobble = (x: number, seed: number) =>
  (Math.sin(x * 1.0 + seed) * 0.5 +
    Math.sin(x * 2.17 + seed * 1.7) * 0.3 +
    Math.sin(x * 3.71 + seed * 2.3) * 0.2);
