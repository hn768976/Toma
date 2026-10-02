// Seeded PRNG. Used only at module level so every schedule, layout and string
// is fixed when the bundle loads and identical on every render thread.
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

// Stateless integer hash -> [0, 1). Safe to call at render time because it
// depends only on its arguments (e.g. the looped frame number).
export const hash01 = (n: number, salt = 0) => {
  let h = (Math.imul(n | 0, 0x27d4eb2d) ^ Math.imul(salt | 0, 0x165667b1)) >>> 0;
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35) >>> 0;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};

export const range = (r: () => number, a: number, b: number) => a + (b - a) * r();
export const pick = <T,>(r: () => number, arr: readonly T[]): T => arr[Math.floor(r() * arr.length)];
