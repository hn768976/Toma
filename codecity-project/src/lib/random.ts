// Seeded PRNG. Every generator in the project takes one of these, created at
// module level from a fixed seed, so the same seed always builds the same world.
export function mulberry32(seed: number) {
  let a = seed >>> 0;
  return function rand() {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export type Rand = ReturnType<typeof mulberry32>;

export const range = (r: Rand, a: number, b: number) => a + (b - a) * r();
export const irange = (r: Rand, a: number, b: number) => Math.floor(a + (b - a + 1) * r());
export const pick = <T,>(r: Rand, arr: readonly T[]) => arr[Math.floor(r() * arr.length)];

// Stateless hash of integers -> [0,1). Used for per-frame schedules
// (e.g. "which tile is lit during hold #k") so no state is carried between frames.
export function hash01(...n: number[]) {
  let h = 0x811c9dc5;
  for (const v of n) {
    h ^= (v | 0) + 0x9e3779b9 + (h << 6) + (h >>> 2);
    h = Math.imul(h ^ (h >>> 16), 0x85ebca6b);
    h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
    h ^= h >>> 16;
  }
  return (h >>> 0) / 4294967296;
}
