// Seeded randomness. Everything random in this project comes from here, seeded
// at module level or from a fixed seed. Math.random() is never used.

export type Rng = () => number;

export const mulberry32 = (seed: number): Rng => {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

export const range = (rng: Rng, lo: number, hi: number) => lo + (hi - lo) * rng();
export const irange = (rng: Rng, lo: number, hi: number) =>
  Math.floor(lo + (hi - lo + 1) * rng());
export const pick = <T,>(rng: Rng, arr: readonly T[]): T => arr[Math.floor(rng() * arr.length)];
export const chance = (rng: Rng, p: number) => rng() < p;

// Stateless integer hash -> [0,1). Used for per-frame flicker without carrying state.
export const hash01 = (...ns: number[]) => {
  let h = 0x811c9dc5;
  for (const n of ns) {
    h = Math.imul(h ^ (n | 0), 0x01000193);
    h ^= h >>> 13;
    h = Math.imul(h, 0x5bd1e995);
    h ^= h >>> 15;
  }
  return (h >>> 0) / 4294967296;
};

const HEX = "0123456789ABCDEF";
const ALNUM = "ABCDEFGHJKLMNPQRSTUVWXYZ0123456789";
export const code = (rng: Rng, n: number, alphabet = ALNUM) => {
  let s = "";
  for (let i = 0; i < n; i++) s += alphabet[Math.floor(rng() * alphabet.length)];
  return s;
};
export const hex = (rng: Rng, n: number) => code(rng, n, HEX);
export const digits = (rng: Rng, n: number) => code(rng, n, "0123456789");
