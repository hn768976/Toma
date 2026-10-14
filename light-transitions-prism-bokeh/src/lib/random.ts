// Seeded PRNG. Only ever called at module level / during one-time layout
// generation, never per frame, so every frame is a pure function of its index.
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
export const range = (r: Rng, a: number, b: number) => a + (b - a) * r();
