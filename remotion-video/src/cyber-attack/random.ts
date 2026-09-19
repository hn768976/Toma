// Deterministic pseudo-randomness.
//
// Every visual decision in this piece (slice offsets, tear colours, noise)
// has to come out identical on every render, otherwise the 1080p and 4K
// masters would not be the same edit. So nothing here touches Math.random():
// each value is derived from integer coordinates instead.

/** 32-bit integer hash. Same inputs always produce the same output. */
export const hash = (...parts: number[]): number => {
  let h = 0x811c9dc5;
  for (const part of parts) {
    let v = Math.imul(part | 0, 0x9e3779b1) ^ 0x85ebca6b;
    v ^= v >>> 15;
    h = Math.imul(h ^ v, 0x01000193);
    h ^= h >>> 13;
  }
  return h >>> 0;
};

/** Hash of the given parts, normalised to [0, 1). */
export const rand = (...parts: number[]): number => hash(...parts) / 4294967296;

/** Hash of the given parts, normalised to [min, max). */
export const randRange = (
  min: number,
  max: number,
  ...parts: number[]
): number => min + rand(...parts) * (max - min);

/** Picks a deterministic element out of `list`. */
export const pick = <T>(list: readonly T[], ...parts: number[]): T =>
  list[hash(...parts) % list.length];

/** A self-contained stream of numbers, for generating longer sequences. */
export const stream = (seed: number) => {
  let state = (seed | 0) + 0x6d2b79f5;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};
