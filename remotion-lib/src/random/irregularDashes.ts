/**
 * irregularDashes — dash arrays with varied length, gap and perpendicular wander.
 *
 * WHAT: Builds a `setLineDash` / `stroke-dasharray` array whose dashes and gaps
 * each vary around a mean, and optionally returns a per-dash perpendicular
 * offset so the dashes do not all sit exactly on the path.
 *
 * WHY: An even dash array reads as a ladder or a zip — the repetition is the
 * first thing the eye finds, and it makes a HUD element look like a border
 * rather than a measurement. Varying length and gap breaks the beat; the
 * perpendicular wander (`wander`) breaks the straight edge that survives even
 * after the beat is broken.
 *
 * TWO OUTPUTS, TWO USES
 *   `pattern` goes straight into `ctx.setLineDash(...)`. This is the cheap path
 *   and is what you want for a long polyline.
 *   `segments` gives you per-dash placement including the perpendicular offset,
 *   for when you are stroking each dash yourself and want the wander. A dash
 *   array alone cannot express wander — the offsets have to be drawn.
 *
 * PARAMETERS
 *   count       Number of dash+gap pairs to generate.
 *   dash        Mean dash length in px. Default 18.
 *   gap         Mean gap length in px. Default 12.
 *   variance    Fraction each dash and gap may deviate from its mean.
 *               0 = a perfectly even ladder. Default 0.55.
 *   wander      Max perpendicular offset in px, reported per segment.
 *               Default 0 — opt in, because it only applies if you draw the
 *               dashes yourself.
 *   rng         Seeded generator. Required.
 *
 * GOTCHA: Canvas repeats a dash array cyclically. If `count` is small the eye
 * will find the repeat anyway, so the irregularity is wasted — use at least
 * ~12 pairs for a long path, or draw `segments` yourself.
 *
 * EXAMPLE
 *   const { pattern } = irregularDashes({ count: 16, rng });
 *   ctx.setLineDash(pattern);
 *   ctx.stroke(path);
 */
import type { Rng } from '../types';

export type DashSegment = {
  /** Distance along the path where this dash starts. */
  start: number;
  /** Length of this dash. */
  length: number;
  /** Perpendicular offset in px; zero unless `wander` was set. */
  offset: number;
};

export type IrregularDashesOptions = {
  count: number;
  rng: Rng;
  dash?: number;
  gap?: number;
  variance?: number;
  wander?: number;
};

export type IrregularDashes = {
  /** Flat [dash, gap, dash, gap, ...] for setLineDash / stroke-dasharray. */
  pattern: number[];
  /** Per-dash placement, for when you stroke each dash yourself. */
  segments: DashSegment[];
  /** Total length covered by the pattern, one cycle. */
  total: number;
};

export const irregularDashes = ({
  count,
  rng,
  dash = 18,
  gap = 12,
  variance = 0.55,
  wander = 0,
}: IrregularDashesOptions): IrregularDashes => {
  const pattern: number[] = [];
  const segments: DashSegment[] = [];
  let cursor = 0;

  // A dash or gap must never reach zero: a zero-length dash disappears and a
  // zero-length gap silently fuses two dashes, and both re-introduce a beat.
  const vary = (mean: number): number =>
    Math.max(mean * 0.15, mean * (1 + (rng() * 2 - 1) * variance));

  for (let i = 0; i < count; i++) {
    const d = vary(dash);
    const g = vary(gap);
    // Drawn unconditionally so that turning wander on or off does not
    // resequence the generator and change every dash length.
    const w = (rng() * 2 - 1) * wander;

    segments.push({ start: cursor, length: d, offset: w });
    pattern.push(d, g);
    cursor += d + g;
  }

  return { pattern, segments, total: cursor };
};
