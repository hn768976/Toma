export const TAU = Math.PI * 2;

/**
 * Sine driven by the loop position (`cycle` runs 0 -> 1 across the whole clip).
 * Every channel in the animation is built from these, and `frequency` is always
 * a whole number of cycles, so frame 300 lands exactly on frame 0 and the clip
 * loops with no visible cut.
 */
export const osc = (cycle: number, frequency: number, phase: number): number =>
  Math.sin((cycle * frequency + phase) * TAU);

/** Cosine counterpart of {@link osc}, for quadrature (circular) motion paths. */
export const cosc = (cycle: number, frequency: number, phase: number): number =>
  Math.cos((cycle * frequency + phase) * TAU);
