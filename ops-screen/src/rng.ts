/**
 * Seeded PRNG (mulberry32). Everything generated with it runs at module
 * level so listings, log lines and bar values are identical on every
 * frame, in the studio and on the render farm.
 */
export const makeRng = (seed: number) => {
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

export const pick = <T,>(rng: Rng, items: readonly T[]): T =>
  items[Math.floor(rng() * items.length) % items.length];

export const int = (rng: Rng, min: number, max: number): number =>
  min + Math.floor(rng() * (max - min + 1));

/** Zero-padded integer, e.g. pad(7, 3) === "007". */
export const pad = (n: number, width: number): string =>
  String(n).padStart(width, "0");
