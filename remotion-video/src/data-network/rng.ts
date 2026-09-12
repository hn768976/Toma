// Tiny deterministic PRNG. Every HUD module is seeded from its grid slot, so
// the board is identical on every render and on every machine.

export const mulberry32 = (seed: number) => {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

export type Rng = ReturnType<typeof mulberry32>;

export const range = (rng: Rng, min: number, max: number) =>
  min + rng() * (max - min);

export const intRange = (rng: Rng, min: number, max: number) =>
  Math.floor(range(rng, min, max + 1));

export const pick = <T>(rng: Rng, items: readonly T[]): T =>
  items[Math.min(items.length - 1, Math.floor(rng() * items.length))];

/** Hash a string into a seed so modules can be keyed by name. */
export const hashSeed = (input: string) => {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
};

const DIGITS = "0123456789";
const HEX = "0123456789ABCDEF";

export const digits = (rng: Rng, length: number) => {
  let out = "";
  for (let i = 0; i < length; i++) out += DIGITS[Math.floor(rng() * 10)];
  return out;
};

export const hex = (rng: Rng, length: number) => {
  let out = "";
  for (let i = 0; i < length; i++) out += HEX[Math.floor(rng() * 16)];
  return out;
};
