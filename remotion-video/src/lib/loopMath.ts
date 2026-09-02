/**
 * Periodic-motion helpers for compositions that must loop seamlessly.
 *
 * The rule these enforce: every cyclic quantity must have a period that
 * divides the composition's duration exactly, so that frame `duration`
 * would be pixel-identical to frame 0. `divisorsOf` gives you the legal
 * periods to pick from; the rest are ready-made cycles built on them.
 *
 * @example
 * const periods = divisorsOf(600, 40, 200);   // [40,50,60,75,100,120,150,200]
 * const b = 1 + 0.2 * loopSine(frame, 120, phase);
 * const { dx, dy } = closedOrbit(frame, 300, 6, 0.6, phase);
 */

/** Every divisor of `total` within [min, max], ascending. */
export const divisorsOf = (total: number, min = 1, max = total): number[] => {
  const out: number[] = [];
  for (let d = min; d <= max; d++) {
    if (total % d === 0) out.push(d);
  }
  return out;
};

/**
 * sin() on a cycle of `period` frames, phase in turns (0..1).
 * Returns -1..1 and is identical at frame 0 and frame N*period.
 */
export const loopSine = (frame: number, period: number, phase = 0): number =>
  Math.sin(((frame / period) + phase) * Math.PI * 2);

/** Position within the current cycle, 0..1. */
export const loopPhase = (frame: number, period: number, phase = 0): number => {
  const t = (frame / period + phase) % 1;
  return t < 0 ? t + 1 : t;
};

/**
 * A tiny closed elliptical orbit. The offset returns exactly to its start
 * every `period` frames, so particles wander without ever drifting away.
 */
export const closedOrbit = (
  frame: number,
  period: number,
  radius: number,
  aspect: number,
  phase: number,
): { dx: number; dy: number } => {
  const a = (frame / period + phase) * Math.PI * 2;
  return { dx: Math.cos(a) * radius, dy: Math.sin(a) * radius * aspect };
};

/**
 * A travelling band of raised intensity — the profile behind a "signal
 * pulse" sweeping across a field of elements.
 *
 * `s` is the element's position projected onto the pulse direction,
 * normalised so the field spans roughly -1..1. The band starts fully off
 * one end and finishes fully off the other, so the boost is 0 at both
 * ends of the window and the loop stays closed.
 *
 * The trailing edge decays more slowly than the leading edge, which is
 * what makes it read as a wave with direction rather than a glow.
 */
export const pulseBand = (
  s: number,
  progress: number,
  width: number,
  tail: number,
): number => {
  if (progress < 0 || progress > 1) return 0;
  const front = -1.15 - width + progress * (2.3 + width * 2);
  const d = s - front;
  // d > 0: ahead of the front (not yet reached) -> sharp cut.
  // d < 0: behind the front -> longer comet tail.
  const norm = d > 0 ? d / (width * 0.55) : d / (width * tail);
  const shape = Math.exp(-norm * norm);
  // Fade the whole pulse in and out so it cannot pop at the window edges.
  const env = Math.sin(Math.PI * Math.min(1, Math.max(0, progress)));
  return shape * Math.min(1, env * 3);
};

/**
 * True for `hold` frames starting at `start`, wrapping across the loop
 * boundary. Use for one-shot events (a glyph flicker) that must survive
 * being scheduled near frame 0.
 */
export const inLoopWindow = (
  frame: number,
  start: number,
  hold: number,
  total: number,
): boolean => ((frame - start) % total + total) % total < hold;
