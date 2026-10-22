// Stateless, deterministic hash-based randomness so every frame renders
// identically regardless of render order or concurrency.
export const hash = (...ints: number[]): number => {
  let h = 0x811c9dc5;
  for (const n of ints) {
    h ^= Math.floor(n) | 0;
    h = Math.imul(h, 0x01000193);
    h ^= h >>> 15;
    h = Math.imul(h, 0x2c1b3c6d);
    h ^= h >>> 12;
  }
  return (h >>> 0) / 4294967296;
};

// Smooth 1D value noise in [0, 1].
export const noise1 = (seed: number, x: number): number => {
  const i = Math.floor(x);
  const f = x - i;
  const s = f * f * (3 - 2 * f);
  return hash(seed, i) * (1 - s) + hash(seed, i + 1) * s;
};
