import { random } from "remotion";

/**
 * All randomness in the piece is seeded from the composition name through
 * Remotion's `random()`, never Math.random() — the same composition and
 * palette must always reproduce the same image.
 */
export const seeded = (compositionId: string, key: string, index = 0): number =>
  random(`${compositionId}:${key}:${index}`);

/**
 * Per-pixel grain would need millions of `random()` calls, which is far too
 * slow. Instead the grain's single seed comes from `random()` and drives a
 * cheap deterministic PRNG (mulberry32) for the pixels themselves.
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

export const seededStream = (compositionId: string, key: string) =>
  mulberry32(Math.floor(seeded(compositionId, key) * 0xffffffff));
