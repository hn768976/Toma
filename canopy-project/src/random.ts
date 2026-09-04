/**
 * Deterministic helpers. Nothing here may be called with a frame-dependent
 * seed: every instance property is drawn once at module scope so the layout is
 * identical on every frame and in every render worker.
 */

/** mulberry32 — small, fast, and stable across engines. */
export const mulberry32 = (seed: number) => {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

export type Rng = () => number;

export const between = (rng: Rng, lo: number, hi: number) => lo + rng() * (hi - lo);

export const pick = <T,>(rng: Rng, items: readonly T[]): T =>
  items[Math.min(items.length - 1, Math.floor(rng() * items.length))];

/**
 * A periodic wave over the loop.
 *
 * `t` is normalised time in [0, 1). Because `freq` is a whole number the value
 * at t = 1 equals the value at t = 0, so anything driven by this returns
 * exactly to its starting state on the last frame — which is what makes the
 * clip loop without a seam.
 */
export const loopWave = (t: number, freq: number, phase: number) =>
  Math.sin(Math.PI * 2 * (t * freq + phase));

/** Same, but eased 0 → 1 → 0 across the loop rather than swinging negative. */
export const loopBump = (t: number, freq: number, phase: number) =>
  0.5 - 0.5 * Math.cos(Math.PI * 2 * (t * freq + phase));
