/**
 * Loop helpers. The integer frame is reduced modulo the loop length
 * *before* converting to an angle, so frame `LOOP` produces bit-identical
 * inputs to frame 0. Anything driven by `loopPhase(frame, k)` with an
 * integer `k` completes exactly `k` whole cycles per loop.
 */
export const mod = (n: number, m: number) => ((n % m) + m) % m;

export const loopPhase = (frame: number, cycles: number, loop: number) =>
  (2 * Math.PI * mod(Math.round(frame) * cycles, loop)) / loop;
