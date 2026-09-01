/**
 * radialPlaces.ts — scatter N items around a point, without a rosette.
 *
 * WHAT IT DOES
 *   Returns `count` placements around `center`, each with both an angular
 *   and a radial offset applied, so the result never lands on a regular
 *   polygon.
 *
 * WHAT IT IS FOR
 *   The default way to place N things in a circle is
 *   `angle = (i / count) * TAU`, which is exactly regular. At any count
 *   above about six that regularity is immediately legible as a flower,
 *   a wheel, or a clock face — a shape with a strong cultural meaning
 *   that almost never matches what the shot is about. Breaking BOTH axes
 *   is what kills it: jittering angle alone still leaves every item on
 *   one crisp circle, which reads as a dial; jittering radius alone
 *   leaves the spokes.
 *
 * PARAMETERS
 *   count              how many placements to return
 *   center             { x, y } to arrange around
 *   radius             mean distance from centre
 *   seed               integer; same seed => same arrangement
 *   angleJitter        0..~2, in units of the mean angular step. 0 is
 *                      perfectly regular (a rosette — avoid). 1 means an
 *                      item can sit anywhere within half a step either
 *                      way. Default 0.6: clearly irregular while still
 *                      reading as "arranged around", not "scattered".
 *   radiusJitter       fraction of `radius` to vary by. Default 0.12.
 *   radiusDistribution 'gaussian' clusters items near `radius` (a band
 *                      with soft edges); 'uniform' spreads them flat
 *                      across the whole jitter range (a filled annulus).
 *                      Default 'gaussian'.
 *   startAngle         radians; where item 0 sits. Default -PI/2 (top).
 *   arcSpan            radians to spread across. Default TAU (full
 *                      circle). Use a smaller span for a fan or an arc;
 *                      spacing then divides the span, not the circle.
 *
 * RETURNS
 *   RadialPlacement[] — each carries x/y plus the angle and radius it was
 *   built from, because callers usually need the angle again (to orient
 *   the item, or to drive a per-angle brightness ripple).
 *
 * GOTCHA
 *   With a full-circle arcSpan and a large angleJitter, item 0 and item
 *   count-1 can cross over each other at the wrap. That is correct
 *   scatter, but if you are drawing connected segments in index order it
 *   will produce one long chord. Sort by angle first if that matters.
 *
 * USAGE
 *   const places = radialPlaces({ count: 40, center: { x: 960, y: 540 },
 *                                 radius: 260, seed: 7 });
 *   places.map((p) => <circle key={p.index} cx={p.x} cy={p.y} r={3} />);
 */

import type { Point } from "../types";
import { seededGaussian, seededRandom } from "./seededRandom";

export type RadialPlacement = Point & {
  /** Final angle in radians, jitter included. */
  angle: number;
  /** Final distance from centre, jitter included. */
  radius: number;
  /** Position in the original sequence, 0..count-1. */
  index: number;
};

export type RadialPlacesOptions = {
  count: number;
  center: Point;
  radius: number;
  seed: number;
  angleJitter?: number;
  radiusJitter?: number;
  radiusDistribution?: "gaussian" | "uniform";
  startAngle?: number;
  arcSpan?: number;
};

const TAU = Math.PI * 2;

export const radialPlaces = ({
  count,
  center,
  radius,
  seed,
  angleJitter = 0.6,
  radiusJitter = 0.12,
  radiusDistribution = "gaussian",
  startAngle = -Math.PI / 2,
  arcSpan = TAU,
}: RadialPlacesOptions): RadialPlacement[] => {
  if (count <= 0) return [];

  // A full circle has `count` gaps between `count` items; a partial arc
  // has count-1, so the first and last items land exactly on the ends.
  const isFullCircle = Math.abs(arcSpan - TAU) < 1e-9;
  const divisor = isFullCircle ? count : Math.max(1, count - 1);
  const step = arcSpan / divisor;

  const placements: RadialPlacement[] = [];
  for (let i = 0; i < count; i++) {
    const angleOffset = (seededRandom(i, seed + 1) - 0.5) * step * angleJitter;
    const angle = startAngle + i * step + angleOffset;

    const radialSample =
      radiusDistribution === "gaussian"
        ? seededGaussian(i, seed + 10)
        : (seededRandom(i, seed + 20) - 0.5) * 2;
    const r = radius * (1 + radialSample * radiusJitter);

    placements.push({
      index: i,
      angle,
      radius: r,
      x: center.x + r * Math.cos(angle),
      y: center.y + r * Math.sin(angle),
    });
  }
  return placements;
};
