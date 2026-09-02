import { random } from "remotion";

/**
 * Seeded random helpers for Remotion scenes.
 *
 * Remotion renders frames out of order across worker processes, so anything
 * that is not a pure function of (identity, frame) will flicker or pop. Every
 * per-instance value in a scene should come from one of these, keyed by a
 * stable string, and never from Math.random() or Date.now().
 */

export const rnd = (seed: string) => random(seed);

export const rndRange = (seed: string, min: number, max: number) =>
  min + random(seed) * (max - min);

/** Biased toward `min` when p > 1, toward `max` when p < 1. */
export const rndPow = (seed: string, min: number, max: number, p: number) =>
  min + Math.pow(random(seed), p) * (max - min);

export const rndInt = (seed: string, minIncl: number, maxIncl: number) =>
  minIncl + Math.floor(random(seed) * (maxIncl - minIncl + 1));

export const rndPick = <T>(seed: string, options: readonly T[]): T =>
  options[Math.floor(random(seed) * options.length)];

export const rndBool = (seed: string, probability = 0.5) =>
  random(seed) < probability;

/**
 * A fast local PRNG (mulberry32), for the rare case where a seeded hash per
 * value would be far too slow — hundreds of thousands of samples, as in a
 * per-frame film-grain tile. Seed it from rnd() so the output is still a pure
 * function of the frame.
 */
export const mulberry32 = (seed: number) => {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

/** Positive modulo — JS's % keeps the sign of the dividend, which wraps wrong. */
export const wrap = (value: number, span: number) =>
  ((value % span) + span) % span;

export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

export const clamp = (v: number, min: number, max: number) =>
  v < min ? min : v > max ? max : v;
