// Deterministic PRNG (mulberry32). Remotion renders frames out of order
// across workers, so every "random" value must be a pure function of a
// seed - never Math.random().
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

export const rangeFrom = (rng: Rng, min: number, max: number) =>
  min + rng() * (max - min);

export const intFrom = (rng: Rng, min: number, max: number) =>
  Math.floor(rangeFrom(rng, min, max + 1));

export const pickFrom = <T>(rng: Rng, items: T[]): T =>
  items[Math.min(items.length - 1, Math.floor(rng() * items.length))];

export const pickWeighted = <T extends { weight: number }>(
  rng: Rng,
  items: T[],
): T => {
  const total = items.reduce((sum, item) => sum + item.weight, 0);
  let r = rng() * total;
  for (const item of items) {
    r -= item.weight;
    if (r <= 0) return item;
  }
  return items[items.length - 1];
};

// Cheap hash -> [0,1) for per-(index, time-bucket) gating decisions such
// as "is this chip lit during this 8-frame window".
export const hash01 = (a: number, b: number) => {
  let h = (a * 374761393 + b * 668265263) | 0;
  h = (h ^ (h >>> 13)) * 1274126177;
  h = h ^ (h >>> 16);
  return (h >>> 0) / 4294967296;
};
