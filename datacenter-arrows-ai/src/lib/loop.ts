/**
 * Exact loop maths. A looping composition of P frames must show the same
 * picture at frame P as at frame 0. All periodic motion goes through
 * `cyc()`, which uses integer arithmetic so that frame P lands on exactly
 * 0, not on 0.9999999.
 */

/** Fraction [0,1) of the way through `cycles` whole repeats over `period` frames. */
export const cyc = (frame: number, cycles: number, period: number) => {
  const p = Math.round(period);
  const n = (((Math.round(frame) * Math.round(cycles)) % p) + p) % p;
  return n / p;
};

/** Number of completed repeats (integer part matching `cyc`). */
export const cycIndex = (frame: number, cycles: number, period: number) =>
  Math.floor((Math.round(frame) * Math.round(cycles)) / Math.round(period));

/** Sine wave with a whole number of cycles over the loop. Output in [-1, 1]. */
export const loopSin = (
  frame: number,
  cycles: number,
  period: number,
  phase01 = 0,
) => Math.sin(2 * Math.PI * (cyc(frame, cycles, period) + phase01));

/** Frame index wrapped into the loop (for grain and blink seeds). */
export const loopFrame = (frame: number, period: number) =>
  ((Math.round(frame) % period) + period) % period;
