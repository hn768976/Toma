/**
 * Seeded helpers. Every random value in the piece comes through here, so a frame
 * is a pure function of its number and `npx remotion render` is deterministic.
 */
import { random } from "remotion";

/** Uniform in [min, max). */
export const rand = (seed: string, min = 0, max = 1) =>
  min + random(seed) * (max - min);

/** Integer in [min, max]. */
export const randInt = (seed: string, min: number, max: number) =>
  Math.floor(min + random(seed) * (max - min + 1));

/** Picks one item. */
export const pick = <T,>(seed: string, items: readonly T[]): T =>
  items[Math.floor(random(seed) * items.length) % items.length];

/** True with probability p. */
export const chance = (seed: string, p: number) => random(seed) < p;

/**
 * A value that rerolls `perSecond` times a second, seeded from the frame so it is
 * stable for any given frame. Panel values use this to flicker without animating.
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

/** Irregular, non-uniform positions along a span — never evenly spaced. */
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
