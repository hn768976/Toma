/**
 * rings.ts — roundedPill, brokenArcRing, tickRing.
 *
 * WHAT THEY ARE FOR
 *   The three small builders that show up in almost every HUD, dashboard,
 *   loader, badge or instrument overlay. Grouped in one file because they
 *   share the arc maths and are rarely used apart.
 *
 * ALL THREE RETURN PATH STRINGS. None of them carry colour, stroke width
 * or opacity — set those on the element you put the path in.
 */

import type { Point } from "../types";
import { seededRandom } from "../random/seededRandom";

/** A point on a circle, angle in radians, 0 = east. */
const onCircle = (center: Point, radius: number, angle: number): Point => ({
  x: center.x + Math.cos(angle) * radius,
  y: center.y + Math.sin(angle) * radius,
});

/** One arc as SVG path data, from `startAngle` to `endAngle` (radians). */
export const arcPath = (
  center: Point,
  radius: number,
  startAngle: number,
  endAngle: number,
): string => {
  const start = onCircle(center, radius, startAngle);
  const end = onCircle(center, radius, endAngle);
  const sweep = endAngle - startAngle;
  const largeArc = Math.abs(sweep) > Math.PI ? 1 : 0;
  const sweepFlag = sweep > 0 ? 1 : 0;
  return `M ${start.x} ${start.y} A ${radius} ${radius} 0 ${largeArc} ${sweepFlag} ${end.x} ${end.y}`;
};

/**
 * roundedPill — a rectangle with semicircular ends.
 *
 * WHAT IT IS FOR
 *   Tags, chips, progress tracks, capsule buttons, the lozenge behind a
 *   lower-third caption.
 *
 * PARAMETERS
 *   x, y            top-left corner
 *   width, height   box size
 *   radius          corner radius. Defaults to height / 2, which is the
 *                   true pill. Pass less for a rounded rectangle.
 *
 * GOTCHA
 *   radius is clamped to half the SHORTER side. A "pill" whose width is
 *   less than its height therefore comes out as a circle, not a vertical
 *   capsule — swap width and height and rotate if you want that.
 */
export const roundedPill = ({
  x,
  y,
  width,
  height,
  radius,
}: {
  x: number;
  y: number;
  width: number;
  height: number;
  radius?: number;
}): string => {
  const r = Math.min(radius ?? height / 2, width / 2, height / 2);
  return [
    `M ${x + r} ${y}`,
    `L ${x + width - r} ${y}`,
    `A ${r} ${r} 0 0 1 ${x + width - r} ${y + height}`,
    `L ${x + r} ${y + height}`,
    `A ${r} ${r} 0 0 1 ${x + r} ${y}`,
    "Z",
  ].join(" ");
};

/**
 * brokenArcRing — a ring drawn as separate arc segments with gaps.
 *
 * WHAT IT IS FOR
 *   HUD reticles, loading rings, radar sweeps, the concentric decoration
 *   around a dial. A broken ring reads as instrumentation; a solid one
 *   reads as a border.
 *
 * WHY THE GAPS SHOULD BE UNEVEN
 *   Evenly spaced identical segments produce a rosette — the same failure
 *   mode radialPlaces exists to avoid. `jitter` varies each segment's
 *   length so the ring reads as designed rather than as a dashed circle.
 *   At jitter 0 you get the even version, which is occasionally what you
 *   want (a progress track) but rarely what looks good as decoration.
 *
 * PARAMETERS
 *   center, radius
 *   segments    arc count. Default 5.
 *   gapDeg      degrees of gap between segments. Default 14.
 *   jitter      0..1 variation in segment length. Default 0.35.
 *   seed        integer, only used when jitter > 0. Default 1.
 *   startDeg    where segment 0 begins. Default -90 (top).
 *   sweepDeg    total degrees to cover. Default 360.
 *
 * RETURNS
 *   string[] — one path per segment. Stroke them; do not fill.
 */
export const brokenArcRing = ({
  center,
  radius,
  segments = 5,
  gapDeg = 14,
  jitter = 0.35,
  seed = 1,
  startDeg = -90,
  sweepDeg = 360,
}: {
  center: Point;
  radius: number;
  segments?: number;
  gapDeg?: number;
  jitter?: number;
  seed?: number;
  startDeg?: number;
  sweepDeg?: number;
}): string[] => {
  const count = Math.max(1, segments);
  const totalGap = gapDeg * count;
  const arcBudget = Math.max(0, sweepDeg - totalGap);
  const evenArc = arcBudget / count;

  // Jitter each arc, then renormalise so the ring still spans sweepDeg
  // exactly — otherwise the last segment lands wherever the drift left it.
  const weights: number[] = [];
  let weightSum = 0;
  for (let i = 0; i < count; i++) {
    const w = 1 + (seededRandom(i, seed + 1) - 0.5) * 2 * jitter;
    const clamped = Math.max(0.15, w);
    weights.push(clamped);
    weightSum += clamped;
  }

  const paths: string[] = [];
  let cursor = startDeg;
  for (let i = 0; i < count; i++) {
    const arc = evenArc * count * (weights[i] / weightSum);
    paths.push(
      arcPath(
        center,
        radius,
        (cursor * Math.PI) / 180,
        ((cursor + arc) * Math.PI) / 180,
      ),
    );
    cursor += arc + gapDeg;
  }
  return paths;
};

/**
 * tickRing — radial tick marks around a circle, major and minor.
 *
 * WHAT IT IS FOR
 *   Dials, gauges, compasses, countdown rings, the graduated edge of a
 *   scientific-looking overlay.
 *
 * PARAMETERS
 *   center, radius   radius is where ticks START (their inner end)
 *   count            total ticks. Default 60.
 *   majorEvery       every Nth tick is long. Default 5. 0 disables.
 *   minorLength      px. Default 8.
 *   majorLength      px. Default 18.
 *   startDeg         angle of tick 0. Default -90 (top).
 *   sweepDeg         total coverage. Default 360.
 *   inward           draw toward the centre instead of outward.
 *                    Default false.
 *
 * RETURNS
 *   TickMark[] — each with its path, whether it is major, its angle and
 *   index, so callers can colour or animate individual ticks (a sweeping
 *   highlight is just a function of `index`).
 *
 * GOTCHA
 *   With sweepDeg 360, tick 0 and tick `count` would coincide, so the
 *   last position is skipped. With a partial sweep both ends are drawn.
 */
export type TickMark = {
  path: string;
  major: boolean;
  angle: number;
  index: number;
};

export const tickRing = ({
  center,
  radius,
  count = 60,
  majorEvery = 5,
  minorLength = 8,
  majorLength = 18,
  startDeg = -90,
  sweepDeg = 360,
  inward = false,
}: {
  center: Point;
  radius: number;
  count?: number;
  majorEvery?: number;
  minorLength?: number;
  majorLength?: number;
  startDeg?: number;
  sweepDeg?: number;
  inward?: boolean;
}): TickMark[] => {
  const isFullCircle = Math.abs(sweepDeg - 360) < 1e-9;
  const divisor = isFullCircle ? count : Math.max(1, count - 1);
  const step = sweepDeg / divisor;

  const ticks: TickMark[] = [];
  for (let i = 0; i < count; i++) {
    const angle = ((startDeg + i * step) * Math.PI) / 180;
    const major = majorEvery > 0 && i % majorEvery === 0;
    const length = major ? majorLength : minorLength;

    const inner = onCircle(center, radius, angle);
    const outer = onCircle(center, radius + (inward ? -length : length), angle);

    ticks.push({
      index: i,
      angle,
      major,
      path: `M ${inner.x} ${inner.y} L ${outer.x} ${outer.y}`,
    });
  }
  return ticks;
};
