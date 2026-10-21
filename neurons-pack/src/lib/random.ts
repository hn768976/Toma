// Seeded randomness. Math.random() is never used: every scene builds its
// data once, at module level or in a memo, from these generators.

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

export const range = (rng: Rng, a: number, b: number) => a + (b - a) * rng();
export const irange = (rng: Rng, a: number, b: number) =>
  Math.floor(a + (b - a + 1) * rng());
export const pick = <T>(rng: Rng, arr: readonly T[]): T =>
  arr[Math.floor(rng() * arr.length) % arr.length];
/** Approximately normal (sum of uniforms). */
export const gauss = (rng: Rng) =>
  (rng() + rng() + rng() + rng() + rng() + rng() - 3) / Math.sqrt(0.5);
/** Uniform random unit vector. */
export const unitVec = (rng: Rng): [number, number, number] => {
  const z = rng() * 2 - 1;
  const t = rng() * Math.PI * 2;
  const r = Math.sqrt(1 - z * z);
  return [r * Math.cos(t), r * Math.sin(t), z];
};
/** Weighted choice: returns an index. */
export const weighted = (rng: Rng, weights: readonly number[]) => {
  let total = 0;
  for (const w of weights) total += w;
  let x = rng() * total;
  for (let i = 0; i < weights.length; i++) {
    x -= weights[i];
    if (x <= 0) return i;
  }
  return weights.length - 1;
};
