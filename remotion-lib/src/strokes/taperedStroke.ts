/**
 * taperedStroke.ts — a stroke whose width and alpha fall off along a path.
 *
 * WHAT IT DOES
 *   Two constructions for the same idea:
 *     taperedStrokeOutline()  -> ONE filled path with a true continuous
 *                                taper, no alpha variation.
 *     taperedStrokeSegments() -> N short segments, each with its own
 *                                width AND alpha.
 *
 * WHAT IT IS FOR
 *   Brush strokes, comet tails, lightning branches, speed lines, calligraphic
 *   underlines — anything that should start or end as a point rather than
 *   as a blunt cap. A constant-width stroke reads as machine-drawn; taper
 *   is most of what makes a mark look made by hand or by motion.
 *
 * WHY TWO FUNCTIONS
 *   SVG and canvas both have exactly one lineWidth per stroke call. There
 *   is no taper primitive. So you either:
 *     (a) stop stroking and build a filled OUTLINE — offset the path to
 *         both sides by the local half-width and close it. This gives a
 *         genuinely smooth taper in a single node, but the whole shape has
 *         one fill, so alpha cannot vary along it; or
 *     (b) chop the path into segments and stroke each at its own width and
 *         alpha. This gets both falloffs, at the cost of N nodes and
 *         visible faceting if N is too low or the width range too wide.
 *   Prefer (a) whenever alpha is constant. Reach for (b) for a comet tail
 *   or anything fading into the background.
 *
 * PARAMETERS (both)
 *   points       the path as a polyline. Sample your curve first — these
 *                helpers do not parse SVG path data. 24-64 points is
 *                usually right; too few shows facets, too many costs nodes.
 *   startWidth   width at points[0]. Default 0 (a true point).
 *   endWidth     width at the last point. Default 8.
 *   profile      how width moves between them: "linear" (default),
 *                "ease" (smoothstep — softer at both ends), or a custom
 *                (t: number) => number returning a 0..1 multiplier.
 *
 * PARAMETERS (segments only)
 *   startAlpha   Default 0.
 *   endAlpha     Default 1.
 *
 * GOTCHA
 *   taperedStrokeOutline offsets along the local normal, so it self-
 *   intersects on curves tighter than the stroke's own half-width — the
 *   outline crosses itself and the fill develops a pinch or a bowtie. If
 *   your path has hairpins, either subdivide more finely, reduce the max
 *   width, or use the segment form, which cannot self-intersect.
 *
 * USAGE
 *   const pts = midpointDisplacement({ ... }).points;
 *   <path d={taperedStrokeOutline(pts, { startWidth: 0, endWidth: 10 })}
 *         fill={strokeColor} />
 */

import type { Point } from "../types";

export type TaperProfile = "linear" | "ease" | ((t: number) => number);

const applyProfile = (profile: TaperProfile, t: number): number => {
  if (typeof profile === "function") return profile(t);
  if (profile === "ease") return t * t * (3 - 2 * t); // smoothstep
  return t;
};

/** Unit normals at each point, averaged across the joins. */
const normalsFor = (points: readonly Point[]): Point[] => {
  const normals: Point[] = [];
  for (let i = 0; i < points.length; i++) {
    const previous = points[Math.max(0, i - 1)];
    const next = points[Math.min(points.length - 1, i + 1)];
    const dx = next.x - previous.x;
    const dy = next.y - previous.y;
    const len = Math.hypot(dx, dy) || 1;
    // Rotate the tangent 90 degrees.
    normals.push({ x: -dy / len, y: dx / len });
  }
  return normals;
};

export type TaperedStrokeOptions = {
  startWidth?: number;
  endWidth?: number;
  profile?: TaperProfile;
};

/**
 * Builds a closed, fillable outline: down one side of the path and back
 * up the other. Fill it — do NOT stroke it.
 */
export const taperedStrokeOutline = (
  points: readonly Point[],
  { startWidth = 0, endWidth = 8, profile = "linear" }: TaperedStrokeOptions = {},
): string => {
  if (points.length < 2) return "";
  const normals = normalsFor(points);
  const last = points.length - 1;

  const halfWidthAt = (i: number): number => {
    const t = applyProfile(profile, i / last);
    return (startWidth + (endWidth - startWidth) * t) / 2;
  };

  const left: string[] = [];
  const right: string[] = [];
  for (let i = 0; i <= last; i++) {
    const h = halfWidthAt(i);
    const n = normals[i];
    const p = points[i];
    left.push(`${p.x + n.x * h} ${p.y + n.y * h}`);
    right.push(`${p.x - n.x * h} ${p.y - n.y * h}`);
  }
  right.reverse();

  return `M ${left.join(" L ")} L ${right.join(" L ")} Z`;
};

export type TaperedSegment = {
  from: Point;
  to: Point;
  width: number;
  alpha: number;
  index: number;
};

/**
 * Chops the path into per-segment records carrying their own width and
 * alpha. Stroke each one; overlapping round caps hide the joins.
 */
export const taperedStrokeSegments = (
  points: readonly Point[],
  {
    startWidth = 0,
    endWidth = 8,
    startAlpha = 0,
    endAlpha = 1,
    profile = "linear",
  }: TaperedStrokeOptions & {
    startAlpha?: number;
    endAlpha?: number;
  } = {},
): TaperedSegment[] => {
  if (points.length < 2) return [];
  const segments: TaperedSegment[] = [];
  const spans = points.length - 1;

  for (let i = 0; i < spans; i++) {
    // Evaluate at the segment midpoint so width is symmetric about it.
    const t = applyProfile(profile, (i + 0.5) / spans);
    segments.push({
      index: i,
      from: points[i],
      to: points[i + 1],
      width: startWidth + (endWidth - startWidth) * t,
      alpha: startAlpha + (endAlpha - startAlpha) * t,
    });
  }
  return segments;
};
