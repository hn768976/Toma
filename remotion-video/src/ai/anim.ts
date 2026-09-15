// Timing helpers shared by the nine versions.
//
// Durations differ per version (10s to 25s), so most motion is written against
// a normalised 0..1 progress rather than absolute frames. That way the same
// choreography reads correctly whether it has 300 frames or 750 to play out in.

/** Clamp to 0..1. */
export const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);

/** Normalised progress through the whole composition. */
export const progress = (frame: number, durationInFrames: number) =>
  clamp01(frame / Math.max(1, durationInFrames - 1));

/** Remap `v` from [a,b] to 0..1, clamped. */
export const remap = (v: number, a: number, b: number) =>
  clamp01((v - a) / (b - a || 1));

/** Smooth 0..1 ramp between `a` and `b`. */
export const ramp = (v: number, a: number, b: number) => {
  const t = remap(v, a, b);
  return t * t * (3 - 2 * t);
};

/** Ramp up between a..b then back down between c..d. Useful for one-off beats. */
export const pulseBetween = (
  v: number,
  a: number,
  b: number,
  c: number,
  d: number,
) => Math.min(ramp(v, a, b), 1 - ramp(v, c, d));

export const easeOutCubic = (t: number) => 1 - Math.pow(1 - clamp01(t), 3);
export const easeInOutCubic = (t: number) => {
  const x = clamp01(t);
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
};
export const easeOutQuint = (t: number) => 1 - Math.pow(1 - clamp01(t), 5);

/**
 * Slow drift that never repeats visibly but is exactly reproducible. Summing
 * two incommensurable sine rates avoids the obvious loop a single sine gives.
 */
export const drift = (t: number, rate = 1, phase = 0) =>
  Math.sin(t * rate + phase) * 0.6 + Math.sin(t * rate * 0.618 + phase * 1.7) * 0.4;

/**
 * Eased in-and-out envelope for the whole composition: fades content up at the
 * start and back down at the end so every version can loop or cut cleanly.
 */
export const envelope = (p: number, inEnd = 0.08, outStart = 0.9) =>
  Math.min(ramp(p, 0, inEnd), 1 - ramp(p, outStart, 1));
