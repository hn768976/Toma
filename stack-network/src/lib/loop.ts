/**
 * Loop-safe motion helpers.
 *
 * Every value here is a function of `progress` -- the frame count divided
 * by the composition duration -- and every one of them returns to its
 * frame-0 value at progress === 1. The trick throughout is that the
 * multiplier applied to progress is always a whole number of cycles, so
 * frame 600 lands exactly where frame 0 started and the clip can be
 * looped without a visible seam.
 */

export const TAU = Math.PI * 2;

/** Sine that completes exactly `cycles` whole turns over the loop. */
export const loopSin = (progress: number, cycles: number, phase = 0) =>
  Math.sin(TAU * (cycles * progress + phase));

/** Cosine counterpart of {@link loopSin}. */
export const loopCos = (progress: number, cycles: number, phase = 0) =>
  Math.cos(TAU * (cycles * progress + phase));

/** {@link loopSin} remapped from [-1, 1] onto [min, max]. */
export const loopRange = (
  progress: number,
  cycles: number,
  phase: number,
  min: number,
  max: number,
) => min + ((loopSin(progress, cycles, phase) + 1) / 2) * (max - min);

/**
 * A point travelling round a small ellipse, used for node and bokeh
 * drift. Returns to the start of the ellipse after `cycles` turns.
 */
export const driftOffset = (
  progress: number,
  cycles: number,
  phase: number,
  radiusX: number,
  radiusY: number,
) => ({
  x: loopCos(progress, cycles, phase) * radiusX,
  y: loopSin(progress, cycles, phase * 1.37) * radiusY,
});

/** Fractional part, always in [0, 1) even for negative input. */
export const wrap01 = (value: number) => value - Math.floor(value);

/**
 * Position of a travelling dot as a fraction of its path.
 *
 * `trips` whole journeys are completed over the loop, so a dot leaving a
 * node at frame 0 is back at that same node at frame 600.
 */
export const tripProgress = (progress: number, trips: number, phase: number) =>
  wrap01(trips * progress + phase);
