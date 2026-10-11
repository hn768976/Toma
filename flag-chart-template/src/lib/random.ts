// Seeded PRNG. Always create it with a fixed seed where the values are built
// (once per composition), so every Remotion worker thread produces the same
// sequence; never call Math.random() at render time.
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

/** Module-level seed for the whole project. */
export const SEED = 0x5eed1234;
/** A fresh generator for one consumer, derived from the module-level seed. */
export const seeded = (salt: number) => mulberry32(SEED ^ salt);
