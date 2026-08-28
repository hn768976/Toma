import { random } from "remotion";

/**
 * All randomness flows through Remotion's random() with stable string seeds,
 * so the layout is identical on every render and across machines.
 */

export const rand = (seed: string): number => random(seed);

export const randRange = (seed: string, min: number, max: number): number =>
  min + random(seed) * (max - min);

export const randInt = (seed: string, min: number, max: number): number =>
  min + Math.floor(random(seed) * (max - min + 1));

export const pickWeighted = <T extends { weight: number }>(
  seed: string,
  items: readonly T[],
): T => {
  const total = items.reduce((s, it) => s + it.weight, 0);
  let r = random(seed) * total;
  for (const it of items) {
    r -= it.weight;
    if (r <= 0 && it.weight > 0) return it;
  }
  // Fallback for r landing exactly on trailing zero-weight entries.
  for (let i = items.length - 1; i >= 0; i--) {
    if (items[i].weight > 0) return items[i];
  }
  return items[0];
};
