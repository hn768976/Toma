import { cumulativeLengths, type Point } from "./drawOn";
import { randChance, seededSequence } from "./random";

/**
 * Right-angle circuit trace generator.
 *
 * Produces a field of orthogonal polylines with square pads at some vertices
 * and short perpendicular stub terminations. Turn positions and run lengths
 * are irregular multiples of a coarse grid: a regular walk reads as a printed
 * pattern rather than a board.
 *
 * Subject-agnostic and palette-agnostic — it emits geometry only.
 */

export type Trace = {
  index: number;
  points: Point[];
  /** Cumulative length at each point; last entry is the total path length. */
  cumulative: number[];
  totalLength: number;
  /** Indices into `points` that carry a pad. */
  padIndices: number[];
  /** 0-1 weight, so a minority of traces can be drawn brighter than the rest. */
  brightness: number;
};

export const generateTraces = ({
  width,
  height,
  count,
  gridSize,
  minTurns = 3,
  maxTurns = 9,
  maxRun = 6,
  padChance = 0.3,
  stubChance = 0.55,
  reverseChance = 0.35,
  seed,
}: {
  width: number;
  height: number;
  count: number;
  gridSize: number;
  /** Segments per trace, inclusive range. */
  minTurns?: number;
  maxTurns?: number;
  /** Longest single run, in grid cells. */
  maxRun?: number;
  /** Probability a vertex carries a pad. */
  padChance?: number;
  /** Probability a trace ends in a short perpendicular stub. */
  stubChance?: number;
  /** Probability of reversing direction at a turn; low values make traces
   *  travel across the frame, high values make them curl up on themselves. */
  reverseChance?: number;
  seed: string;
}): Trace[] => {
  const traces: Trace[] = [];
  const cols = Math.max(2, Math.floor(width / gridSize));
  const rows = Math.max(2, Math.floor(height / gridSize));

  for (let t = 0; t < count; t++) {
    const rng = seededSequence(`${seed}:trace:${t}`);
    let col = Math.floor(rng.next() * cols);
    let row = Math.floor(rng.next() * rows);
    // Alternating axis guarantees right angles by construction — there is no
    // code path that can emit a diagonal.
    let horizontal = rng.next() < 0.5;
    let dir = rng.next() < 0.5 ? 1 : -1;

    const turns = minTurns + Math.floor(rng.next() * (maxTurns - minTurns + 1));
    const points: Point[] = [{ x: col * gridSize, y: row * gridSize }];

    for (let s = 0; s < turns; s++) {
      const run = 1 + Math.floor(rng.next() * maxRun);
      if (horizontal) col = Math.max(0, Math.min(cols, col + dir * run));
      else row = Math.max(0, Math.min(rows, row + dir * run));

      const next = { x: col * gridSize, y: row * gridSize };
      const prev = points[points.length - 1];
      if (next.x !== prev.x || next.y !== prev.y) points.push(next);
      horizontal = !horizontal;
      if (rng.next() < reverseChance) dir = -dir;
    }

    if (points.length < 2) continue;

    if (rng.next() < stubChance) {
      const last = points[points.length - 1];
      const stub = gridSize * (0.35 + rng.next() * 0.4);
      const sign = rng.next() < 0.5 ? 1 : -1;
      points.push(
        horizontal
          ? { x: last.x + stub * sign, y: last.y }
          : { x: last.x, y: last.y + stub * sign },
      );
    }

    const cumulative = cumulativeLengths(points);
    const padIndices: number[] = [];
    for (let i = 0; i < points.length; i++) {
      if (randChance(`${seed}:pad:${t}:${i}`, padChance)) padIndices.push(i);
    }

    traces.push({
      index: t,
      points,
      cumulative,
      totalLength: cumulative[cumulative.length - 1],
      padIndices,
      brightness: rng.next(),
    });
  }

  return traces;
};
