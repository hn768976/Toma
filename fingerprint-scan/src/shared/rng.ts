/**
 * Seeded random helpers built on Remotion's `random()`.
 *
 * Every value is a pure function of its seed string, so anything driven by
 * these is reproducible across renders and across machines. Never use
 * Math.random() in a Remotion project — it makes frames non-deterministic.
 */
import { random } from "remotion";

/** Uniform in [min, max). */
export const rand = (seed: string, min = 0, max = 1) =>
  min + random(seed) * (max - min);

/** Integer in [min, max], inclusive. */
export const randInt = (seed: string, min: number, max: number) =>
  Math.floor(min + random(seed) * (max - min + 1));

/** Picks one item from a list. */
export const pick = <T,>(seed: string, items: readonly T[]): T =>
  items[Math.floor(random(seed) * items.length) % items.length];

/** True with probability `p`. */
export const chance = (seed: string, p: number) => random(seed) < p;

/**
 * A value that rerolls `perSecond` times a second, seeded from the frame so it
 * is stable for any given frame. Use for HUD panel values that should flicker
 * without being animated.
 */
export const rerolled = (
  seed: string,
  frame: number,
  fps: number,
  perSecond: number,
) => {
  const bucket = Math.floor((frame * perSecond) / fps);
  return random(`${seed}-${bucket}`);
};

/**
 * `count` positions spread across [from, to] with seeded jitter, so they read as
 * irregular rather than as a evenly spaced row. `jitter` is a fraction of the
 * mean spacing.
 */
export const irregularPositions = (
  seed: string,
  count: number,
  from: number,
  to: number,
  jitter = 0.7,
) => {
  const out: number[] = [];
  const span = to - from;
  for (let i = 0; i < count; i++) {
    const base = (i + 0.5) / count;
    const j = (random(`${seed}-pos-${i}`) - 0.5) * (jitter / count);
    out.push(from + Math.min(0.999, Math.max(0.001, base + j)) * span);
  }
  return out;
};
