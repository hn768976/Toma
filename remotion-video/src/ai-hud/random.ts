// mulberry32 — a tiny deterministic PRNG.
//
// Remotion renders frames out of order across worker threads, so nothing that
// ends up on screen may come from Math.random() at render time. Every random
// decision in this project (trace geometry, bokeh paths, panel contents,
// counter series) is made ONCE at module scope with a fixed seed, and the
// results are frozen into plain data structures before the first frame is
// drawn.
export const mulberry32 = (seed: number) => {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

/** A seeded generator bundled with the range helpers used across the build. */
export const makeRng = (seed: number) => {
  const next = mulberry32(seed);
  const range = (min: number, max: number) => min + next() * (max - min);
  return {
    next,
    range,
    int: (min: number, max: number) => Math.floor(range(min, max + 1)),
    pick: <T,>(items: readonly T[]) => items[Math.floor(next() * items.length)],
    bool: (chance = 0.5) => next() < chance,
  };
};

export type Rng = ReturnType<typeof makeRng>;
