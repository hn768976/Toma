/**
 * midpointDisplacement — recursive branching geometry.
 *
 * WHAT: Takes a start and end point, recursively displaces the midpoint of each
 * segment perpendicular to it, and optionally spawns forks at those midpoints.
 * Returns a set of polylines.
 *
 * WHY IT IS ONE FUNCTION AND NOT FOUR: lightning, plasma filaments, bronchial
 * trees, river deltas and root systems are the same algorithm. Across the
 * source projects, each caller varied only the parameters — displacement scale,
 * recursion depth, branch probability, branch angle. Extracting the parameters
 * instead of the shapes is what makes one function cover all of them:
 *
 *   lightning   depth 7, displacement 0.32, branchProbability 0.4, angle 0.5
 *   plasma      depth 6, displacement 0.55, branchProbability 0.7, angle 1.1
 *   bronchi     depth 5, displacement 0.10, branchProbability 1.0, angle 0.6
 *   roots       depth 6, displacement 0.22, branchProbability 0.8, angle 0.9
 *
 * HOW: displacement at each level is scaled by the segment's own length and
 * halved as the recursion descends, which is what makes the result look like
 * the same process at every scale rather than like noise added to a line.
 *
 * PARAMETERS
 *   start, end          Endpoints of the main channel.
 *   rng                 Seeded generator. Required.
 *   depth               Recursion levels. Each adds a point between every
 *                       existing pair, so the main channel has 2^depth + 1
 *                       points. Default 7 (129 points). Above ~10 you are
 *                       paying for detail below one pixel.
 *   displacement        Perpendicular offset at the top level, as a fraction of
 *                       the segment length. Default 0.32.
 *   roughness           How much displacement survives each level down. 0.5
 *                       halves it (self-similar, the classic value). Higher
 *                       gives a wilder, hairier path. Default 0.5.
 *   branchProbability   Chance a midpoint spawns a fork, 0..1. Default 0.4.
 *                       Set 0 for a single unbranched filament.
 *   branchAngle         Max fork deviation from the parent direction, radians.
 *                       Default 0.5 (~29 degrees).
 *   branchDepth         How many levels deep forks may still spawn. Default 3.
 *                       Limiting this keeps the tip region clean, which is
 *                       what stops the result reading as a bush.
 *   branchLengthRatio   A fork's length relative to its parent's remaining
 *                       length. Default 0.55.
 *   maxGeneration       Forks of forks of forks. Default 2.
 *
 * RETURNS `{ strokes }` where each stroke carries its polyline, its generation
 * (0 = main channel), and a suggested `width` and `brightness` multiplier that
 * falls off with generation — so callers get the visual hierarchy for free
 * rather than recomputing it.
 *
 * GOTCHA: point count is exponential in `depth`. Depth 12 on a branching config
 * is millions of points and will hang the render. Keep depth <= 9.
 *
 * EXAMPLE
 *   const { strokes } = midpointDisplacement({
 *     start: { x: 960, y: 0 }, end: { x: 900, y: 1080 }, rng,
 *   });
 *   for (const s of strokes) {
 *     neonStroke({ ctx, path: (c) => polyline(c, s.points),
 *                  color: '#6AA9FF', coreColor: '#FFFFFF',
 *                  width: 3 * s.width, intensity: s.brightness });
 *   }
 */
import type { Point, Rng } from '../types';

export type BranchStroke = {
  points: Point[];
  /** 0 = main channel, 1 = fork, 2 = fork of a fork. */
  generation: number;
  /** Suggested width multiplier; falls off with generation. */
  width: number;
  /** Suggested alpha/intensity multiplier; falls off with generation. */
  brightness: number;
};

export type MidpointDisplacementOptions = {
  start: Point;
  end: Point;
  rng: Rng;
  depth?: number;
  displacement?: number;
  roughness?: number;
  branchProbability?: number;
  branchAngle?: number;
  branchDepth?: number;
  branchLengthRatio?: number;
  maxGeneration?: number;
};

export type MidpointDisplacementResult = {
  strokes: BranchStroke[];
};

type BranchSite = {
  point: Point;
  /** Unit direction of the parent segment at this site. */
  dx: number;
  dy: number;
  /** Distance from this site to the end of the parent channel. */
  remaining: number;
  /** Seeded draw for the spawn decision, taken when the site was found. */
  draw: number;
};

/**
 * Subdivides one segment, accumulating into `out`. `a` must already be in `out`.
 * Branch sites found along the way are pushed into `sites`.
 */
const subdivide = (
  a: Point,
  b: Point,
  level: number,
  maxLevel: number,
  amp: number,
  roughness: number,
  branchDepth: number,
  rng: Rng,
  sites: BranchSite[],
  out: Point[],
): void => {
  if (level >= maxLevel) {
    out.push(b);
    return;
  }

  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy) || 1;
  const perpX = -dy / len;
  const perpY = dx / len;

  const offset = (rng() * 2 - 1) * amp * len;
  const mid: Point = {
    x: (a.x + b.x) / 2 + perpX * offset,
    y: (a.y + b.y) / 2 + perpY * offset,
  };

  // The branch draw happens at every level regardless of whether this level is
  // eligible, so that changing branchDepth does not resequence the generator
  // and reshape the whole path.
  const branchDraw = rng();
  if (level < branchDepth) {
    sites.push({
      point: mid,
      dx: dx / len,
      dy: dy / len,
      remaining: Math.hypot(b.x - mid.x, b.y - mid.y),
      draw: branchDraw,
    });
  }

  const nextAmp = amp * roughness;
  subdivide(a, mid, level + 1, maxLevel, nextAmp, roughness, branchDepth, rng, sites, out);
  subdivide(mid, b, level + 1, maxLevel, nextAmp, roughness, branchDepth, rng, sites, out);
};

export const midpointDisplacement = ({
  start,
  end,
  rng,
  depth = 7,
  displacement = 0.32,
  roughness = 0.5,
  branchProbability = 0.4,
  branchAngle = 0.5,
  branchDepth = 3,
  branchLengthRatio = 0.55,
  maxGeneration = 2,
}: MidpointDisplacementOptions): MidpointDisplacementResult => {
  const strokes: BranchStroke[] = [];

  const buildChannel = (
    from: Point,
    to: Point,
    generation: number,
    levels: number,
  ): void => {
    const points: Point[] = [from];
    const sites: BranchSite[] = [];

    subdivide(
      from,
      to,
      0,
      Math.max(0, levels),
      displacement,
      roughness,
      generation < maxGeneration ? branchDepth : 0,
      rng,
      sites,
      points,
    );

    strokes.push({
      points,
      generation,
      // Each generation is thinner and dimmer than its parent. These factors
      // are what produce a readable hierarchy instead of a uniform tangle.
      width: Math.pow(0.62, generation),
      brightness: Math.pow(0.7, generation),
    });

    if (generation >= maxGeneration || branchProbability <= 0) return;

    for (const site of sites) {
      if (site.draw > branchProbability) continue;

      // Fork direction: the parent direction rotated by a seeded angle. Sign is
      // drawn separately so forks go both ways rather than all one side.
      const side = rng() < 0.5 ? -1 : 1;
      const theta = Math.atan2(site.dy, site.dx) + side * branchAngle * (0.4 + rng() * 0.6);
      const length = site.remaining * branchLengthRatio * (0.6 + rng() * 0.6);
      if (length < 1) continue;

      buildChannel(
        site.point,
        {
          x: site.point.x + Math.cos(theta) * length,
          y: site.point.y + Math.sin(theta) * length,
        },
        generation + 1,
        // Forks are shorter, so they need fewer levels for the same point
        // density — and this is what keeps the total point count bounded.
        Math.max(1, levels - 2),
      );
    }
  };

  buildChannel(start, end, 0, depth);
  return { strokes };
};

/** Lays a polyline onto a context. Convenience for the `path` thunk. */
export const polyline = (
  ctx: CanvasRenderingContext2D,
  points: readonly Point[],
): void => {
  if (points.length < 2) return;
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i++) ctx.lineTo(points[i].x, points[i].y);
};
