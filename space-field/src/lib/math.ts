/**
 * Small numeric helpers shared by every layer.
 *
 * Everything in this project is a pure function of the frame number, so any
 * periodic motion has to close exactly at the loop boundary. The helpers that
 * matter for that are `loopPhase` (frame -> 0..1) and `closedWave`, which is
 * only ever fed integer frequency multipliers.
 */

export const TAU = Math.PI * 2;

export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

export const clamp = (value: number, lo: number, hi: number) =>
  value < lo ? lo : value > hi ? hi : value;

export const smoothstep = (edge0: number, edge1: number, x: number) => {
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
};

/** Position within the loop, 0 at the first frame and 1 one frame past the last. */
export const loopPhase = (frame: number, loopLength: number) =>
  (frame % loopLength) / loopLength;

/**
 * A sine that completes `frequency` whole cycles per loop. `frequency` must be
 * an integer or the loop will not close.
 */
export const closedWave = (phase: number, frequency: number, offset: number) =>
  Math.sin(TAU * (phase * frequency + offset));

/** Deterministic weighted pick from a table, driven by an r in [0, 1). */
export const pickWeighted = <T>(
  table: readonly { readonly weight: number; readonly value: T }[],
  r: number,
): T => {
  let total = 0;
  for (const entry of table) {
    total += entry.weight;
  }
  let cursor = r * total;
  for (const entry of table) {
    cursor -= entry.weight;
    if (cursor <= 0) {
      return entry.value;
    }
  }
  return table[table.length - 1].value;
};

/** Index form of `pickWeighted`, for tables that are parallel to other arrays. */
export const pickWeightedIndex = (
  weights: readonly number[],
  r: number,
): number => {
  let total = 0;
  for (const weight of weights) {
    total += weight;
  }
  let cursor = r * total;
  for (let i = 0; i < weights.length; i++) {
    cursor -= weights[i];
    if (cursor <= 0) {
      return i;
    }
  }
  return weights.length - 1;
};

/**
 * Distance from a frame to an event start, measured the short way around the
 * loop. Keeps timed events (bursts, flares) seamless across the wrap point.
 */
export const loopDistance = (frame: number, start: number, loopLength: number) => {
  const raw = (((frame - start) % loopLength) + loopLength) % loopLength;
  return raw;
};
