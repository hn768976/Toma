/**
 * Deterministic randomness for Remotion pieces.
 *
 * Everything routes through Remotion's `random()` with a stable STRING seed.
 * Remotion renders frames out of order across workers, so any value that is
 * not a pure function of its seed shows up as flicker between frames.
 * `Math.random()` must never appear in a composition.
 *
 * @module seeded
 */
import { random } from "remotion";

export const rnd = (seed: string) => random(seed);

export const rndRange = (seed: string, min: number, max: number) =>
  min + random(seed) * (max - min);

export const rndInt = (seed: string, min: number, maxExclusive: number) =>
  min + Math.floor(random(seed) * (maxExclusive - min));

export const rndPick = <T>(seed: string, items: readonly T[]): T =>
  items[Math.min(items.length - 1, Math.floor(random(seed) * items.length))];

export const rndBool = (seed: string, chance = 0.5) => random(seed) < chance;

/**
 * The index of the `size`-frame bucket `frame` falls in, wrapped to `period`.
 *
 * Use it to hold a value steady for a few frames — a readout that rerolls
 * 6x/second, a border that flashes — while keeping the cadence periodic over
 * the loop. Pick a `size` that divides `period` exactly, or the last bucket
 * of the loop is short and the seam shows.
 */
export const bucketOf = (frame: number, size: number, period: number) =>
  Math.floor((((frame % period) + period) % period) / size);
