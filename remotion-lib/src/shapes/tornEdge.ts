/**
 * tornEdge.ts — a paper tear, at two noise scales, with fibres.
 *
 * WHAT IT DOES
 *   Generates an irregular edge along a straight line, displaced by a
 *   coarse wave and a fine jitter, and optionally a band of short fibre
 *   strands hanging off it.
 *
 * WHAT IT IS FOR
 *   Torn-paper transitions and collage layouts: a scrapbook look, a
 *   ripped-headline title card, a wipe between two scenes that should not
 *   look like a rectangle sliding.
 *
 * WHY TWO NOISE SCALES
 *   A tear has structure at two very different sizes at once. The coarse
 *   scale is where the sheet actually gave way — slow bends every few
 *   centimetres. The fine scale is the fibre-by-fibre roughness along
 *   that line. One scale alone always reads wrong: coarse only looks like
 *   a torn-edge *icon*, a lazy wave; fine only looks like a straight cut
 *   that someone sanded. You need the slow bend AND the grain.
 *
 * WHY THE FIBRE BAND
 *   Real torn paper does not end at a line, it ends at a fringe: a
 *   shallow band where fibres separate from the sheet before the tear
 *   completes. Without it, even a well-shaped edge reads as cut. This is
 *   the detail that sells the effect at close range, and it is cheap.
 *
 * PARAMETERS
 *   from, to        endpoints of the nominal edge
 *   seed            integer; same seed => same tear
 *   segments        samples along the edge. Default 120. This sets the
 *                   finest detail available; 120 across 1920px is a
 *                   sample every 16px, which is about right for the fine
 *                   scale to read at 1080p.
 *   coarseAmplitude px of the slow bend. Default 18.
 *   coarseScale     cycles across the whole edge. Default 3.
 *   fineAmplitude   px of the fibre-scale jitter. Default 4.
 *   fineScale       cycles across the whole edge. Default 34.
 *   fibreCount      strands in the fringe. Default 60. 0 disables.
 *   fibreLength     mean strand length in px. Default 9.
 *   fillDepth       how far `closed` extends past the nominal line, in px.
 *                   Defaults to the edge's own length, which for a
 *                   full-width tear comfortably covers the frame. This is
 *                   the depth of the SHEET, not of the tear: too small and
 *                   you fill a narrow band rather than a page.
 *
 * RETURNS
 *   points  the edge as a polyline
 *   path    the edge as an open SVG path (stroke it, or use as a clip)
 *   closed  a closed path from the edge back along `from`/`to`'s far side
 *           — this is what you FILL to get a torn sheet
 *   fibres  short line paths for the fringe; stroke them thin
 *
 * GOTCHA
 *   `closed` fills toward the side the edge normal points AWAY from,
 *   which for a left-to-right edge is downward. Reverse `from` and `to`
 *   to fill the other side, rather than trying to negate amplitudes.
 *
 * USAGE
 *   const tear = tornEdge({ from: { x: 0, y: 400 },
 *                           to: { x: 1920, y: 430 }, seed: 6 });
 *   <path d={tear.closed} fill={paperColor} />
 *   {tear.fibres.map((d, i) => <path key={i} d={d} stroke={paperColor} />)}
 */

import type { Point } from "../types";
import { seededRandom } from "../random/seededRandom";

export type TornEdgeOptions = {
  from: Point;
  to: Point;
  seed: number;
  segments?: number;
  coarseAmplitude?: number;
  coarseScale?: number;
  fineAmplitude?: number;
  fineScale?: number;
  fibreCount?: number;
  fibreLength?: number;
  fillDepth?: number;
};

export type TornEdgeResult = {
  points: Point[];
  path: string;
  closed: string;
  fibres: string[];
};

export const tornEdge = ({
  from,
  to,
  seed,
  segments = 120,
  coarseAmplitude = 18,
  coarseScale = 3,
  fineAmplitude = 4,
  fineScale = 34,
  fibreCount = 60,
  fibreLength = 9,
  fillDepth,
}: TornEdgeOptions): TornEdgeResult => {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const length = Math.hypot(dx, dy) || 1;
  // Unit normal: the direction the edge wanders in.
  const nx = -dy / length;
  const ny = dx / length;

  // Random phases keep two tears with adjacent seeds from rhyming.
  const coarsePhase = seededRandom(0, seed + 1) * Math.PI * 2;
  const finePhase = seededRandom(0, seed + 2) * Math.PI * 2;

  const points: Point[] = [];
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const coarse =
      Math.sin(t * Math.PI * 2 * coarseScale + coarsePhase) * coarseAmplitude;
    // The fine layer is sine plus a per-sample random kick; pure sine at
    // this frequency would read as a regular ripple, not as grain.
    const fine =
      Math.sin(t * Math.PI * 2 * fineScale + finePhase) * fineAmplitude * 0.5 +
      (seededRandom(i, seed + 10) - 0.5) * 2 * fineAmplitude * 0.5;
    const offset = coarse + fine;

    points.push({
      x: from.x + dx * t + nx * offset,
      y: from.y + dy * t + ny * offset,
    });
  }

  const path = `M ${points.map((p) => `${p.x} ${p.y}`).join(" L ")}`;

  // Close by dropping to the far side of the nominal line. The default
  // depth is the edge's own length: enough that a full-width tear fills
  // to the frame edge rather than leaving a floating band.
  const overshoot = fillDepth ?? length;
  const closed =
    `${path}` +
    ` L ${to.x - nx * overshoot} ${to.y - ny * overshoot}` +
    ` L ${from.x - nx * overshoot} ${from.y - ny * overshoot} Z`;

  const fibres: string[] = [];
  for (let i = 0; i < fibreCount; i++) {
    // Anchor each strand at a sampled point on the edge itself.
    const at = Math.floor(seededRandom(i, seed + 20) * segments);
    const anchor = points[at];
    const strand = fibreLength * (0.4 + seededRandom(i, seed + 30) * 1.2);
    // Splay each strand off the normal so the fringe is not a comb.
    const splay = (seededRandom(i, seed + 40) - 0.5) * 0.8;
    const angle = Math.atan2(ny, nx) + splay;
    fibres.push(
      `M ${anchor.x} ${anchor.y} L ${anchor.x + Math.cos(angle) * strand} ${
        anchor.y + Math.sin(angle) * strand
      }`,
    );
  }

  return { points, path, closed, fibres };
};
