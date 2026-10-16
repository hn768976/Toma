// Deterministic randomness. Everything random in this project is generated
// at module level from fixed seeds, or hashed from integers (particle id,
// frame bucket, pixel position). Math.random() is never used.

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

export type Rng = ReturnType<typeof mulberry32>;

/** Integer hash (lowbias32) mapped to [0, 1). Same function as the GLSL one. */
export const hash01 = (...ints: number[]) => {
  let h = 0x9e3779b9;
  for (const v of ints) {
    h ^= (v | 0) >>> 0;
    h ^= h >>> 16;
    h = Math.imul(h, 0x7feb352d);
    h ^= h >>> 15;
    h = Math.imul(h, 0x846ca68b);
    h ^= h >>> 16;
  }
  return (h >>> 0) / 4294967296;
};

export const range = (rng: Rng, a: number, b: number) => a + (b - a) * rng();
export const pick = <T,>(rng: Rng, arr: readonly T[]): T =>
  arr[Math.floor(rng() * arr.length) % arr.length];

/** Approximately normal (Irwin-Hall, 4 terms), mean 0, sd ~1. */
export const gauss = (rng: Rng) =>
  (rng() + rng() + rng() + rng() - 2) * Math.sqrt(3);

/** GLSL version of hash01 for shaders (WebGL2 / GLSL ES 3.00). */
export const GLSL_HASH = /* glsl */ `
uint lowbias32(uint x) {
  x ^= x >> 16; x *= 0x7feb352du;
  x ^= x >> 15; x *= 0x846ca68bu;
  x ^= x >> 16; return x;
}
float hash3(uint a, uint b, uint c) {
  uint h = 0x9e3779b9u;
  h ^= a; h = lowbias32(h);
  h ^= b; h = lowbias32(h);
  h ^= c; h = lowbias32(h);
  return float(h >> 8) / 16777216.0;
}
`;
