// Seeded PRNG. Only ever called at module level (or inside memoised builders
// that run once with a fixed seed) — never per frame.
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
export const pick = <T,>(r: Rng, arr: readonly T[]): T =>
  arr[Math.floor(r() * arr.length) % arr.length];
// Approximately normal, mean 0, sd ~1.
export const gauss = (r: Rng) => {
  let s = 0;
  for (let i = 0; i < 6; i++) s += r();
  return (s - 3) * 1.4142;
};

// Stateless hash of integers → [0,1). Safe to call per frame because it
// depends only on its inputs.
export const hash1 = (n: number) => {
  let x = Math.imul((n | 0) ^ 0x9e3779b9, 0x85ebca6b);
  x ^= x >>> 13;
  x = Math.imul(x, 0xc2b2ae35);
  x ^= x >>> 16;
  return (x >>> 0) / 4294967296;
};
export const hash2 = (a: number, b: number) => hash1(Math.imul(a | 0, 73856093) ^ Math.imul(b | 0, 19349663));
