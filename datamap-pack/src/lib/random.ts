// Seeded PRNG. Every generator in the project calls this at module level
// (or inside a memo keyed on constant inputs); nothing on screen ever uses
// Math.random().
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

// Stateless integer hash -> [0,1). Used for values that depend on the frame
// (ticking numbers, scrambles), so any frame can be computed on its own.
export const hash01 = (...ints: number[]) => {
  let h = 0x811c9dc5;
  for (const n of ints) {
    h ^= n | 0;
    h = Math.imul(h, 0x01000193);
    h ^= h >>> 13;
    h = Math.imul(h, 0x5bd1e995);
    h ^= h >>> 15;
  }
  return (h >>> 0) / 4294967296;
};

export const LOOP = 600;
export const TAU = Math.PI * 2;
// Loop phase in [0,1): frame 600 maps back to frame 0 exactly.
export const loopPhase = (frame: number) => (((frame % LOOP) + LOOP) % LOOP) / LOOP;
export const loopFrame = (frame: number) => ((frame % LOOP) + LOOP) % LOOP;
