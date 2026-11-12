// Deterministic, seedable PRNG so every render of a frame is identical
// (Remotion renders frames out of order and in parallel tabs).
export type Rng = {
  next: () => number;
  range: (min: number, max: number) => number;
  gauss: () => number;
  pick: <T>(items: readonly T[]) => T;
};

export const createRng = (seed: number): Rng => {
  let a = seed >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const gauss = () => {
    // Box-Muller
    const u = Math.max(next(), 1e-9);
    const v = next();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  };
  return {
    next,
    range: (min, max) => min + (max - min) * next(),
    gauss,
    pick: (items) => items[Math.floor(next() * items.length) % items.length],
  };
};
