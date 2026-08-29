import { random } from "remotion";

/**
 * Every random value in this piece flows through Remotion's `random()` with a
 * stable string seed, so a frame renders identically on every machine and on
 * every re-render. `Math.random()` is never used.
 */
export const rnd = (seed: string): number => random(seed);

export const rndRange = (seed: string, lo: number, hi: number): number =>
  lo + random(seed) * (hi - lo);

export const rndInt = (seed: string, lo: number, hi: number): number =>
  Math.floor(lo + random(seed) * (hi - lo + 1));

export const rndPick = <T,>(seed: string, list: readonly T[]): T =>
  list[Math.min(list.length - 1, Math.floor(random(seed) * list.length))];

export const rndBool = (seed: string, chance: number): boolean =>
  random(seed) < chance;

/** Signed value in [-1, 1). */
export const rndSigned = (seed: string): number => random(seed) * 2 - 1;

/**
 * Zero-padded integer as a string, e.g. pad(7, 2) -> "07".
 * Digits only, so it carries no display copy of its own.
 */
export const pad = (value: number, width: number): string => {
  let out = String(Math.abs(Math.round(value)));
  while (out.length < width) out = "0" + out;
  return out;
};
