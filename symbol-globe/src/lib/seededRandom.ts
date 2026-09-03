/**
 * Deterministic random helpers built on Remotion's `random()`.
 *
 * Every value is a pure function of a stable string seed, so a frame rendered
 * on worker 3 at 2am is byte-identical to the same frame rendered anywhere
 * else. Never use Math.random() in a Remotion composition: renders are
 * distributed across processes and frames are produced out of order.
 */
import { random } from "remotion";

/** Uniform value in [0, 1) for a stable string seed. */
export const rand = (seed: string): number => random(seed);

/** Uniform value in [min, max). */
export const randRange = (seed: string, min: number, max: number): number =>
  min + random(seed) * (max - min);

/** Uniform integer in [min, maxExclusive). */
export const randInt = (
  seed: string,
  min: number,
  maxExclusive: number,
): number => min + Math.floor(random(seed) * (maxExclusive - min));

/** True with probability `p`. */
export const randChance = (seed: string, p: number): boolean =>
  random(seed) < p;

/** Uniform pick from a list. */
export const randPick = <T>(seed: string, items: readonly T[]): T =>
  items[Math.min(items.length - 1, Math.floor(random(seed) * items.length))];

/**
 * Picks from `items` according to their `weight`. Weights need not sum to 1;
 * they are normalised internally.
 */
export const randWeighted = <T extends { weight: number }>(
  seed: string,
  items: readonly T[],
): T => {
  const total = items.reduce((sum, item) => sum + item.weight, 0);
  let target = random(seed) * total;
  for (const item of items) {
    target -= item.weight;
    if (target <= 0) return item;
  }
  return items[items.length - 1];
};

/**
 * A closed 2D drift path: a Lissajous figure whose frequencies are whole
 * numbers of cycles per loop, so position at `t = 1` equals position at
 * `t = 0` exactly. `t` is normalised loop progress in [0, 1].
 */
export const closedDrift = (
  seed: string,
  t: number,
  amplitudeX: number,
  amplitudeY: number,
  maxHarmonic = 3,
): { x: number; y: number } => {
  const fx = 1 + Math.floor(random(`${seed}-fx`) * maxHarmonic);
  const fy = 1 + Math.floor(random(`${seed}-fy`) * maxHarmonic);
  const px = random(`${seed}-px`) * Math.PI * 2;
  const py = random(`${seed}-py`) * Math.PI * 2;
  return {
    x: Math.sin(Math.PI * 2 * fx * t + px) * amplitudeX,
    y: Math.cos(Math.PI * 2 * fy * t + py) * amplitudeY,
  };
};
