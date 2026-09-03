// All structural randomness goes through Remotion's `random()` with stable
// string seeds, so the node set, label set and bokeh field are byte-identical
// on every render and across every worker. Math.random() is never used.
import { random } from "remotion";

export const rnd = (seed: string): number => random(seed);

export const rndRange = (seed: string, min: number, max: number): number =>
  min + random(seed) * (max - min);

export const rndInt = (seed: string, min: number, maxExclusive: number): number =>
  min + Math.floor(random(seed) * (maxExclusive - min));

export const rndPick = <T,>(seed: string, items: readonly T[]): T =>
  items[Math.floor(random(seed) * items.length) % items.length];

/**
 * mulberry32 — a fast integer PRNG used ONLY for bulk per-pixel work (film
 * grain), where calling `random()` a million times per frame would dominate
 * the render. Its seed is itself derived from `random()` on the frame index,
 * so the output is still a pure, deterministic function of the frame number.
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
