/**
 * Loop timing. The clip is LOOP_FRAMES long; everything that moves must make a
 * whole number of cycles in that time so frame LOOP_FRAMES == frame 0.
 */
export const FPS = 30;
export const LOOP_FRAMES = 600; // 20 s

export const assertWhole = (n: number, what: string) => {
  if (!Number.isInteger(n)) {
    throw new Error(
      `${what} must be a whole number of cycles per ${LOOP_FRAMES}-frame loop, got ${n}`,
    );
  }
};

/**
 * Fraction [0, 1) through the current cycle of something that completes
 * `cycles` whole cycles per loop. Computed with integer arithmetic, so frame
 * 600 gives exactly the same value as frame 0 (no float drift at the seam).
 * Negative cycle counts run backwards.
 */
export const cycleFrac = (cycles: number, frame: number) => {
  assertWhole(cycles, "cycle count");
  const m = (((cycles * frame) % LOOP_FRAMES) + LOOP_FRAMES) % LOOP_FRAMES;
  return m / LOOP_FRAMES;
};

/** sin(2π · cycles · t + phase), loop-exact. */
export const loopSin = (cycles: number, frame: number, phase = 0) =>
  Math.sin(2 * Math.PI * cycleFrac(cycles, frame) + phase);

/** [cos, sin] of the loop angle — the "circle in time" used for looping noise. */
export const loopCircle = (cycles: number, frame: number): [number, number] => {
  const a = 2 * Math.PI * cycleFrac(cycles, frame);
  return [Math.cos(a), Math.sin(a)];
};
