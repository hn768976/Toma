// Deterministic randomness. Never Math.random(): Remotion renders frames out of
// order on several tabs, so every value must be a pure function of its inputs.

/** mulberry32 PRNG. Create one at module level with a fixed seed. */
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

/** Integer hash of up to three ints -> [0, 1). Stateless, so safe per frame. */
export const hash01 = (a: number, b = 0, c = 0): number => {
  let h = Math.imul((a | 0) ^ 0x9e3779b9, 0x85ebca6b);
  h ^= Math.imul((b | 0) + 0x632be5ab, 0xc2b2ae35);
  h = Math.imul(h ^ (h >>> 13), 0x27d4eb2f);
  h ^= Math.imul((c | 0) + 0x165667b1, 0x9e3779b1);
  h = Math.imul(h ^ (h >>> 16), 0x85ebca6b);
  h ^= h >>> 13;
  return (h >>> 0) / 4294967296;
};

/** Helpers that draw from a seeded generator. */
export const makeRand = (seed: number) => {
  const r = mulberry32(seed);
  return {
    next: r,
    range: (lo: number, hi: number) => lo + (hi - lo) * r(),
    int: (lo: number, hiExclusive: number) => lo + Math.floor((hiExclusive - lo) * r()),
    pick: <T,>(arr: readonly T[]) => arr[Math.floor(r() * arr.length)],
    sign: () => (r() < 0.5 ? -1 : 1),
  };
};
