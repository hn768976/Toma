/**
 * loopPhase.ts — the seamless-loop cycle helper.
 *
 * WHAT IT DOES
 *   Maps a frame number onto a 0..1 position within a repeating cycle,
 *   with a per-element phase offset, correct for negative frames.
 *
 * WHAT IT IS FOR
 *   Every looping element in a stock-footage clip — a pulsing wave, a
 *   packet travelling a curve, a particle drifting outward and fading —
 *   needs the same expression. This is the one helper in this library
 *   that was found genuinely duplicated in existing project code rather
 *   than written from spec: three independent copies of
 *
 *       const t = (((frame / period + phase) % 1) + 1) % 1;
 *
 *   appear in remotion-video (DataPacket.tsx:58, RadioWaves.tsx:52,
 *   ParticleRingHalo.tsx:112), spanning two unrelated builds.
 *
 * WHY THE DOUBLE MODULO
 *   JavaScript's % keeps the sign of its left operand, so a negative
 *   frame (Remotion passes these when a Sequence starts before frame 0)
 *   yields a negative t and the element jumps. `((x % 1) + 1) % 1`
 *   normalises into [0, 1) for any real input.
 *
 * PARAMETERS
 *   frame    current frame; may be negative
 *   period   frames per cycle; must be > 0
 *   phase    offset into the cycle, 0..1 (default 0). Give element i
 *            phase i/count to spread N elements evenly around the loop.
 *
 * GOTCHA
 *   For the composition itself to loop seamlessly, `period` must divide
 *   durationInFrames exactly. 200 frames with period 100 loops; with
 *   period 90 it jumps at the wrap.
 *
 * USAGE
 *   const t = loopPhase(frame, 100, i / count);
 *   const radius = start + t * distance;
 *   const alpha = fadeInOut(t);
 */

/** Position within a repeating cycle, always in [0, 1). */
export const loopPhase = (frame: number, period: number, phase = 0): number => {
  if (period <= 0) return 0;
  return (((frame / period + phase) % 1) + 1) % 1;
};

/**
 * Spreads `count` elements evenly around one cycle and returns each
 * element's current position. Saves writing the i/count phase by hand.
 */
export const loopPhases = (
  frame: number,
  period: number,
  count: number,
): number[] =>
  Array.from({ length: count }, (_, i) => loopPhase(frame, period, i / count));

/**
 * A 0 -> 1 -> 0 fade over one cycle, peaking at t = 0.5. The standard
 * companion to loopPhase for anything that should be invisible at both
 * ends of its travel so the wrap is never seen.
 */
export const fadeInOut = (t: number): number => Math.sin(Math.PI * t);

/**
 * A cosine ease over one cycle: starts at 0, reaches 1 at t = 0.5,
 * returns to 0, with zero derivative at both ends. Smoother than
 * fadeInOut where the value drives position rather than opacity (a
 * triangle or sine peak in position reads as a visible direction change).
 */
export const pingPong = (t: number): number => (1 - Math.cos(t * Math.PI * 2)) / 2;
