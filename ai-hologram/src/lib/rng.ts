/**
 * Seeded PRNG. Every layout decision in the scene — trace routing, particle
 * placement, panel contents, per-element timing offsets — is drawn from one of
 * these so that any two renders of the same frame are byte-identical.
 */
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

export const range = (rng: Rng, min: number, max: number) => min + rng() * (max - min);
export const int = (rng: Rng, min: number, max: number) => Math.floor(range(rng, min, max + 1));
export const pick = <T,>(rng: Rng, items: readonly T[]): T => items[int(rng, 0, items.length - 1)];
