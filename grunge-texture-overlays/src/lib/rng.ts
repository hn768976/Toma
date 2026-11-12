/** Deterministic randomness. Nothing in this project uses Math.random(). */

export type Rng = () => number;

/** mulberry32: small, fast, good-quality 32-bit PRNG. Returns floats in [0, 1). */
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

/** FNV-1a string hash -> uint32. */
export const hashString = (s: string): number => {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
};

/** Module-level master generator: fixes the salt that every stream below is derived from. */
const master = mulberry32(0x47524e47); // "GRNG"
export const MASTER_SALT = Math.floor(master() * 4294967296) >>> 0;

/** A fresh generator for a named stream, e.g. seedFor("ScratchGrunge", "card", 3). */
export const seedFor = (...parts: (string | number)[]): number =>
  (hashString(parts.join(":")) ^ MASTER_SALT) >>> 0;
export const rngFor = (...parts: (string | number)[]): Rng => mulberry32(seedFor(...parts));

// ---- helpers -------------------------------------------------------------
export const range = (r: Rng, a: number, b: number) => a + (b - a) * r();
export const int = (r: Rng, a: number, b: number) => Math.floor(range(r, a, b + 1));
export const chance = (r: Rng, p: number) => r() < p;
export const pick = <T,>(r: Rng, arr: readonly T[]): T => arr[Math.floor(r() * arr.length)];
export const gauss = (r: Rng) => {
  // Box-Muller (one value)
  const u = Math.max(1e-9, r());
  const v = r();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
};
