/**
 * blobPath.ts — an irregular closed organic shape.
 *
 * WHAT IT DOES
 *   Places N points around a centre at varied radii, then joins them with
 *   a smooth closed cubic-bezier curve.
 *
 * WHAT IT IS FOR
 *   Cells, microbes, amoebae, clouds, ink blots, soft background masses,
 *   the "liquid" shapes behind a title card. Anything that should read as
 *   grown rather than constructed.
 *
 * WHY BEZIERS AND NOT A POLYGON
 *   Straight segments between jittered radii produce a visible vertex at
 *   every control point, and the eye counts them — a 9-point blob reads
 *   as a nonagon, not as a cell. Converting to a smooth curve removes the
 *   corners while keeping the silhouette, so the point count stops being
 *   legible and only the irregularity survives.
 *
 * HOW THE SMOOTHING WORKS
 *   Catmull-Rom through the points, converted to cubic beziers. Each
 *   point's tangent is the direction between its two neighbours, so the
 *   curve passes exactly through every control point with C1 continuity.
 *   `tension` scales those tangents.
 *
 * PARAMETERS
 *   center      { x, y }
 *   radius      mean radius in px
 *   points      how many control points. Default 9. Below ~6 the shape
 *               reads as a rounded triangle/square; above ~14 the
 *               irregularity averages out and it converges on a circle.
 *   seed        integer; same seed => same blob
 *   irregularity 0..1, how much each radius may vary. Default 0.28.
 *               Above ~0.5 the curve starts to self-intersect on the
 *               tight bits and you get loops.
 *   tension     bezier handle length as a fraction of the neighbour
 *               distance. Default 0.36. Lower is tighter/more angular,
 *               higher balloons the curve outside its control points.
 *
 * RETURNS
 *   A closed SVG path string. Fill it.
 *
 * GOTCHA
 *   The shape can exceed `radius` — beziers bulge outside their control
 *   points, and irregularity adds to that. Budget roughly
 *   radius * (1 + irregularity) * 1.15 when laying out around it.
 *
 * USAGE
 *   <path d={blobPath({ center: { x: 480, y: 270 }, radius: 140, seed: 3 })}
 *         fill={cellColor} />
 */

import type { Point } from "../types";
import { seededRandom } from "../random/seededRandom";

export type BlobPathOptions = {
  center: Point;
  radius: number;
  seed: number;
  points?: number;
  irregularity?: number;
  tension?: number;
};

/**
 * The control points, exposed separately because callers sometimes want
 * to animate them (a pulsing cell) or place things on the boundary.
 */
export const blobPoints = ({
  center,
  radius,
  seed,
  points = 9,
  irregularity = 0.28,
}: BlobPathOptions): Point[] => {
  const count = Math.max(3, points);
  const result: Point[] = [];
  for (let i = 0; i < count; i++) {
    // Angles stay regular here: the irregularity that matters for an
    // organic mass is radial. Jittering angle too tends to pinch the
    // curve where two points crowd, which reads as a dent, not a lobe.
    const angle = (i / count) * Math.PI * 2;
    const r = radius * (1 + (seededRandom(i, seed + 1) - 0.5) * 2 * irregularity);
    result.push({
      x: center.x + Math.cos(angle) * r,
      y: center.y + Math.sin(angle) * r,
    });
  }
  return result;
};

/**
 * Closed Catmull-Rom through `points`, emitted as cubic beziers.
 * Exported because it is useful for any smooth closed loop, not just blobs.
 */
export const smoothClosedPath = (points: readonly Point[], tension = 0.36): string => {
  const n = points.length;
  if (n < 3) return "";

  const at = (i: number): Point => points[((i % n) + n) % n];

  let d = `M ${at(0).x} ${at(0).y}`;
  for (let i = 0; i < n; i++) {
    const p0 = at(i - 1);
    const p1 = at(i);
    const p2 = at(i + 1);
    const p3 = at(i + 2);

    // Catmull-Rom -> bezier control points.
    const c1: Point = {
      x: p1.x + (p2.x - p0.x) * tension,
      y: p1.y + (p2.y - p0.y) * tension,
    };
    const c2: Point = {
      x: p2.x - (p3.x - p1.x) * tension,
      y: p2.y - (p3.y - p1.y) * tension,
    };
    d += ` C ${c1.x} ${c1.y} ${c2.x} ${c2.y} ${p2.x} ${p2.y}`;
  }
  return `${d} Z`;
};

export const blobPath = (options: BlobPathOptions): string =>
  smoothClosedPath(blobPoints(options), options.tension ?? 0.36);
