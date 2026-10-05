// Seeded PRNG. Only ever called at module level / construction time with a
// fixed seed, so every thread builds identical geometry. Never Math.random().
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

export const LOOP = 600;

/** Loop phase in [0,1). Every animated quantity is a periodic function of this
 * with a whole number of cycles, so frame 600 == frame 0 and 599 -> 600 is continuous. */
export const phaseOf = (frame: number) => (((frame % LOOP) + LOOP) % LOOP) / LOOP;
