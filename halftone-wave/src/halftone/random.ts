// Seeded PRNG. All randomness in this project (dot jitter, grain) comes
// from here so every frame is a pure function of its frame number — no
// Math.random() is ever called at render time.

// mulberry32: small, fast, well-distributed 32-bit generator.
export const mulberry32 = (seed: number): (() => number) => {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};
