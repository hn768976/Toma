// Seeded PRNG. Everything random is generated once at module level (or once
// per mounted scene from a fixed seed) — never Math.random() at render time.
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

export type Rng = () => number;

export const range = (r: Rng, a: number, b: number) => a + (b - a) * r();
export const int = (r: Rng, a: number, b: number) => Math.floor(a + (b - a + 1) * r());
export const pick = <T,>(r: Rng, arr: readonly T[]): T => arr[Math.floor(r() * arr.length)];

// Integer hash -> [0,1). Used for "random" content keyed by (seed, step) so a
// live panel's text at any frame is a pure function of that frame.
export const hash01 = (...n: number[]) => {
  let h = 2166136261 >>> 0;
  for (const v of n) {
    h = Math.imul(h ^ (v | 0), 16777619) >>> 0;
    h = Math.imul(h ^ (h >>> 13), 0x5bd1e995) >>> 0;
  }
  h ^= h >>> 15;
  return (h >>> 0) / 4294967296;
};

export const HEX = "0123456789ABCDEF";
export const hexString = (r: Rng, n: number) => {
  let s = "";
  for (let i = 0; i < n; i++) s += HEX[Math.floor(r() * 16)];
  return s;
};
export const binString = (r: Rng, n: number, sep = "") => {
  const out: string[] = [];
  for (let i = 0; i < n; i++) out.push(r() < 0.5 ? "0" : "1");
  return out.join(sep);
};
