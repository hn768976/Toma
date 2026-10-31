// Deterministic randomness. Nothing in this project calls Math.random():
// every random value comes from mulberry32 seeded by (composition id,
// variant index, salt), so any frame renders identically whether it is
// rendered alone (cold start) or in sequence.

export const mulberry32 = (seed: number) => {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

// FNV-1a string hash -> 32-bit seed.
export const hashString = (s: string) => {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
};

export const seedFor = (...parts: (string | number)[]) =>
  // Rough.js treats seed 0 as "unseeded", so keep it >= 1.
  (hashString(parts.join("|")) % 2147483646) + 1;

export type Rng = ReturnType<typeof makeRng>;

export const makeRng = (...parts: (string | number)[]) => {
  const r = mulberry32(seedFor(...parts));
  return {
    next: r,
    range: (a: number, b: number) => a + (b - a) * r(),
    int: (a: number, b: number) => Math.floor(a + (b - a + 1) * r()),
    sign: () => (r() < 0.5 ? -1 : 1),
    pick: <T,>(arr: readonly T[]) => arr[Math.floor(r() * arr.length)],
    // Approximately normal (Irwin-Hall, 3 samples), mean 0, sd ~1.
    gauss: () => (r() + r() + r() - 1.5) * 2,
  };
};

// Module-level generator, as the brief asks: used only for values that are
// the same for every composition (none of the looks depend on call order).
export const moduleRng = mulberry32(0x5eed1234);
