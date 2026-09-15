// Deterministic PRNG (mulberry32). Remotion renders frames out of order
// across worker threads, so every property of every element has to be a
// pure function of (index, salt) — never Math.random() or Date.now(),
// which would make the field flicker between frames.
export const mulberry32 = (seed: number) => {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

/** A generator seeded from an index and a per-attribute salt. */
export const rngFor = (index: number, salt: number) =>
  mulberry32(index * 9781 + salt * 6151 + 1);
