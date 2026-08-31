// A tiny deterministic PRNG (mulberry32). Every random-looking value in
// this composition — candle steps, wick lengths, label positions and
// values — is derived from an integer seed through this, never from
// Math.random(). Remotion renders frames out of order across workers, so
// anything that isn't a pure function of (seed, frame) would pop between
// frames.
export const mulberry32 = (seed: number) => {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

// Uniform value in [min, max) from a generator.
export const between = (rand: () => number, min: number, max: number) =>
  min + rand() * (max - min);

// Picks an item from a list.
export const pick = <T>(rand: () => number, items: readonly T[]): T =>
  items[Math.min(items.length - 1, Math.floor(rand() * items.length))];
