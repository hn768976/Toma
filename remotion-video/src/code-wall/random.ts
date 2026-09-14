// Deterministic PRNG (mulberry32). Remotion renders frames out of order
// across worker processes, so every value that defines the scene must be a
// pure function of a seed — never Math.random() or Date.now().
export const mulberry32 = (seed: number) => {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

export type Rng = () => number;

export const range = (rng: Rng, min: number, max: number) =>
  min + rng() * (max - min);

export const intRange = (rng: Rng, min: number, max: number) =>
  Math.floor(range(rng, min, max + 1));

export const pick = <T,>(rng: Rng, items: readonly T[]): T =>
  items[Math.min(items.length - 1, Math.floor(rng() * items.length))];

export const chance = (rng: Rng, probability: number) => rng() < probability;
