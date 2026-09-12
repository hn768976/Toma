// Deterministic PRNG. Every element's identity (position, depth, size,
// glyph, phase) is a pure function of its index, never Math.random() —
// Remotion renders frames out of order across workers, so anything else
// would flicker between frames.
export const mulberry32 = (seed: number) => {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

/** Builds a generator seeded from an index plus a per-layer salt. */
export const rngFor = (index: number, salt: number) =>
  mulberry32(index * 9781 + salt * 6151 + 1);

/** Uniform in [min, max). */
export const between = (rand: () => number, min: number, max: number) =>
  min + rand() * (max - min);

export const pick = <T,>(rand: () => number, items: readonly T[]): T =>
  items[Math.floor(rand() * items.length) % items.length];
