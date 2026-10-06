// Deterministic randomness. Nothing on screen may depend on Math.random().
// Seeded generators are created at module level, so every tab that renders a
// frame builds exactly the same data, whatever order frames are rendered in.

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

// Stateless hash in [0,1): use for per-frame values (ticking numbers etc.).
export const hash = (...n: number[]): number => {
  let h = 0x811c9dc5;
  for (const v of n) {
    h ^= Math.floor(v) | 0;
    h = Math.imul(h, 0x01000193);
    h ^= h >>> 13;
    h = Math.imul(h, 0x5bd1e995);
    h ^= h >>> 15;
  }
  return (h >>> 0) / 4294967296;
};

export const randRange = (rnd: () => number, a: number, b: number) =>
  a + (b - a) * rnd();

export const gaussian = (rnd: () => number) => {
  const u = Math.max(1e-9, rnd());
  const v = rnd();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
};

// Invented filler digits, deterministic per (seed, frame-step).
export const digits = (count: number, ...seed: number[]) => {
  let s = "";
  for (let i = 0; i < count; i++) s += Math.floor(hash(...seed, i) * 10);
  return s;
};
