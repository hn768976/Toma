/**
 * midpointDisplacement.ts — recursive branching geometry.
 *
 * WHAT IT DOES
 *   Takes a straight segment, repeatedly splits it and pushes each new
 *   midpoint sideways by a shrinking random amount, and — at each split —
 *   optionally spawns a child branch that recurses the same way.
 *
 * WHAT IT IS FOR
 *   One algorithm behind a whole family of shots: lightning, plasma
 *   filaments, cracks, river deltas, bronchial trees, root systems,
 *   neural dendrites, circuit traces. What separates them is entirely
 *   parameters — how far midpoints move, how fast that decays, how often
 *   branches spawn and at what angle. Lightning is high displacement,
 *   fast decay, low branch probability, wide angle. A root system is low
 *   displacement, slow decay, high branch probability, narrow angle.
 *
 * WHY DISPLACEMENT MUST DECAY
 *   `roughness` halves (by default) the displacement at each level. If it
 *   did not, deep subdivisions would move as far as shallow ones and the
 *   result would be uniform noise at every scale — a fuzzy caterpillar
 *   rather than a bolt with a recognisable overall path and fine detail
 *   riding on it. Self-similarity across scales is the whole effect.
 *
 * PARAMETERS
 *   from, to           trunk endpoints
 *   seed               integer; same seed => same figure
 *   depth              subdivisions. Default 6 => 2^6 = 64 segments.
 *                      Above ~9 you are generating thousands of points
 *                      for detail below one pixel.
 *   displacement       px of sideways push at the FIRST subdivision.
 *                      Default 0.22 * trunk length if omitted.
 *   roughness          multiplier per level. Default 0.5. Below 0.5 the
 *                      figure smooths out fast; above ~0.7 it degenerates
 *                      into noise.
 *   branchProbability  0..1 chance of a child at each subdivision point.
 *                      Default 0.18. Compounding matters: 0.4 at depth 6
 *                      is thousands of branches.
 *   branchAngle        radians a child deviates from its parent's local
 *                      direction. Default 0.5 (~29 degrees). Sign is
 *                      chosen randomly per branch.
 *   branchScale        child length as a fraction of the remaining parent
 *                      segment. Default 0.7.
 *   maxBranchDepth     how many generations of branching. Default 3.
 *                      This is generations, NOT subdivision depth.
 *   minBranchLength    px below which a child is not spawned. Default 8.
 *
 * RETURNS
 *   Branch[] — index 0 is always the trunk. Each carries its polyline,
 *   its generation, and the parent index, so callers can taper or dim by
 *   generation (which is what makes these read as three-dimensional).
 *
 * GOTCHA
 *   Cost is exponential in BOTH depth and branchProbability. depth 8 with
 *   branchProbability 0.5 is a five-figure point count and will stall a
 *   render. Start at the defaults and raise one axis at a time.
 *
 * GOTCHA 2
 *   This is a static figure, not an animation. To animate lightning,
 *   regenerate with a seed derived from the frame (e.g. seed + floor(
 *   frame / 4)) so it re-strikes at a chosen rate — interpolating between
 *   two figures looks like rubber, not electricity.
 *
 * USAGE
 *   const branches = midpointDisplacement({
 *     from: { x: 960, y: 0 }, to: { x: 1020, y: 1080 }, seed: 5,
 *   });
 *   branches.map((b) => <path d={polyPath(b.points)} stroke={boltColor}
 *                             strokeOpacity={1 / (1 + b.generation)} />);
 */

import type { Point } from "../types";
import { makeRng } from "../random/seededRandom";

export type Branch = {
  points: Point[];
  /** 0 for the trunk, 1 for its children, and so on. */
  generation: number;
  /** Index into the returned array; -1 for the trunk. */
  parent: number;
};

export type MidpointDisplacementOptions = {
  from: Point;
  to: Point;
  seed: number;
  depth?: number;
  displacement?: number;
  roughness?: number;
  branchProbability?: number;
  branchAngle?: number;
  branchScale?: number;
  maxBranchDepth?: number;
  minBranchLength?: number;
};

type PendingBranch = {
  from: Point;
  to: Point;
  generation: number;
  parent: number;
};

/**
 * Subdivides one segment `depth` times, displacing each midpoint along
 * the segment normal. Returns the polyline and the midpoints that are
 * candidates for spawning branches.
 */
const displaceSegment = (
  from: Point,
  to: Point,
  depth: number,
  displacement: number,
  roughness: number,
  rng: () => number,
): { points: Point[]; midpoints: Point[] } => {
  let points: Point[] = [from, to];
  const midpoints: Point[] = [];
  let amount = displacement;

  for (let level = 0; level < depth; level++) {
    const next: Point[] = [points[0]];
    for (let i = 0; i < points.length - 1; i++) {
      const a = points[i];
      const b = points[i + 1];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const len = Math.hypot(dx, dy) || 1;
      // Unit normal to this segment.
      const nx = -dy / len;
      const ny = dx / len;
      const push = (rng() - 0.5) * 2 * amount;

      const mid: Point = {
        x: (a.x + b.x) / 2 + nx * push,
        y: (a.y + b.y) / 2 + ny * push,
      };
      midpoints.push(mid);
      next.push(mid, b);
    }
    points = next;
    amount *= roughness;
  }

  return { points, midpoints };
};

export const midpointDisplacement = ({
  from,
  to,
  seed,
  depth = 6,
  displacement,
  roughness = 0.5,
  branchProbability = 0.18,
  branchAngle = 0.5,
  branchScale = 0.7,
  maxBranchDepth = 3,
  minBranchLength = 8,
}: MidpointDisplacementOptions): Branch[] => {
  const rng = makeRng(seed);
  const trunkLength = Math.hypot(to.x - from.x, to.y - from.y);
  const baseDisplacement = displacement ?? trunkLength * 0.22;

  const branches: Branch[] = [];
  const queue: PendingBranch[] = [
    { from, to, generation: 0, parent: -1 },
  ];

  while (queue.length > 0) {
    const current = queue.shift() as PendingBranch;
    const length = Math.hypot(
      current.to.x - current.from.x,
      current.to.y - current.from.y,
    );
    // Shallower subdivision for shorter branches: a 20px twig does not
    // need 64 segments, and giving it them is where the cost explodes.
    const branchDepth = Math.max(
      1,
      depth - current.generation - (length < trunkLength / 4 ? 1 : 0),
    );

    const { points, midpoints } = displaceSegment(
      current.from,
      current.to,
      branchDepth,
      baseDisplacement * Math.pow(branchScale, current.generation),
      roughness,
      rng,
    );

    const index = branches.length;
    branches.push({
      points,
      generation: current.generation,
      parent: current.parent,
    });

    if (current.generation >= maxBranchDepth) continue;

    for (const mid of midpoints) {
      if (rng() > branchProbability) continue;

      // Direction of the parent at this point, rotated by +/- branchAngle.
      const dx = current.to.x - current.from.x;
      const dy = current.to.y - current.from.y;
      const parentAngle = Math.atan2(dy, dx);
      const side = rng() < 0.5 ? -1 : 1;
      // Vary the angle a little so branches are not all identical forks.
      const angle = parentAngle + side * branchAngle * (0.6 + rng() * 0.8);
      const childLength = length * branchScale * (0.5 + rng() * 0.5);
      if (childLength < minBranchLength) continue;

      queue.push({
        from: mid,
        to: {
          x: mid.x + Math.cos(angle) * childLength,
          y: mid.y + Math.sin(angle) * childLength,
        },
        generation: current.generation + 1,
        parent: index,
      });
    }
  }

  return branches;
};

/** Convenience: a polyline as SVG path data. */
export const polyPath = (points: readonly Point[]): string => {
  if (points.length === 0) return "";
  return `M ${points.map((p) => `${p.x} ${p.y}`).join(" L ")}`;
};
