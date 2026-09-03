/**
 * Seeded-random helpers built on Remotion's `random()`.
 *
 * Remotion renders frames out of order across worker processes, so anything
 * derived from `Math.random()` or `Date.now()` would differ between frames and
 * flicker. Everything here is a pure function of its string seed, which makes
 * a render bit-for-bit reproducible.
 */
import { random } from "remotion";

/** 0..1 from a stable string seed. */
export const rand = (seed: string): number => random(seed);

/** Uniform value in `[min, max)` from a stable string seed. */
export const randRange = (seed: string, min: number, max: number): number =>
  min + random(seed) * (max - min);

/** Uniform integer in `[min, max]` from a stable string seed. */
export const randInt = (seed: string, min: number, max: number): number =>
  Math.floor(min + random(seed) * (max - min + 1));

/** Picks one element of `items` from a stable string seed. */
export const randPick = <T,>(seed: string, items: readonly T[]): T =>
  items[Math.min(items.length - 1, Math.floor(random(seed) * items.length))];

/**
 * A closed drift path: a Lissajous figure with integer frequencies, so it
 * returns exactly to its starting point after `period` frames. Use this
 * wherever something must move but the clip must still loop.
 */
export const closedDrift = (
  seed: string,
  frame: number,
  period: number,
  amplitude: number,
  freqX = 1,
  freqY = 2,
): { x: number; y: number } => {
  const t = (frame / period) * Math.PI * 2;
  const phaseX = random(`${seed}-px`) * Math.PI * 2;
  const phaseY = random(`${seed}-py`) * Math.PI * 2;
  return {
    x: Math.sin(t * freqX + phaseX) * amplitude,
    y: Math.cos(t * freqY + phaseY) * amplitude,
  };
};
