import { random } from "remotion";

// Every value that varies per tree / per particle comes from here. Remotion's
// random() is a pure hash of its seed, so the same string always yields the
// same number — which is what makes the forest identical on every render,
// across every worker, in any frame order.

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
 * A fast local PRNG, used only where a seeded hash per value would be far too
 * slow — currently just the ~590k samples of the film-grain tile. Its own seed
 * still comes from random(), so the output stays a pure function of the frame.
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
