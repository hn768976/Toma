/**
 * Loop helpers.
 *
 * Everything animated in this project is a pure function of the normalised
 * loop position t = frame / durationInFrames, which runs 0 -> 1 across the
 * clip. Anything built from whole-cycle sines of t, or sampled on a circle in
 * t, returns exactly to its frame-0 value, so the clip can be butt-joined to
 * itself with no visible seam. Buyers loop these under a product shot for
 * minutes at a time, so a seam every ten seconds is disqualifying.
 */

/** Normalised loop position in [0, 1). */
export const loopT = (frame: number, durationInFrames: number): number =>
  (frame % durationInFrames) / durationInFrames;

/**
 * A sine that completes `cycles` whole turns across the loop.
 * Returns -1..1. `cycles` must be a whole number for the loop to close.
 */
export const loopSin = (t: number, cycles = 1, phase = 0): number =>
  Math.sin((t * cycles + phase) * Math.PI * 2);

/** As loopSin, remapped to 0..1. Handy for pulsing intensities. */
export const loopPulse = (t: number, cycles = 1, phase = 0): number =>
  loopSin(t, cycles, phase) * 0.5 + 0.5;

/**
 * Sample position on the unit circle in time. Feeding these two values into
 * two axes of a noise field gives noise that varies continuously and returns
 * exactly to its start - the standard trick for loopable procedural motion.
 */
export const loopCircle = (t: number, cycles = 1): [number, number] => [
  Math.cos(t * cycles * Math.PI * 2),
  Math.sin(t * cycles * Math.PI * 2),
];

/**
 * Staggered sawtooth for recycling props (look 4's falling spheres).
 *
 * Each prop gets a fixed phase offset, and its progress is derived from the
 * frame rather than accumulated, so it resets once per cycle at a time unique
 * to it. With `cycleFrames` dividing evenly into the composition duration the
 * whole field returns to its frame-0 arrangement at the loop point.
 */
export const sawtooth = (
  frame: number,
  cycleFrames: number,
  offsetFrames: number,
): number => (((frame + offsetFrames) % cycleFrames) + cycleFrames) % cycleFrames / cycleFrames;

/** Smoothstep, matching the GLSL definition. */
export const smoothstep = (edge0: number, edge1: number, x: number): number => {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
};
