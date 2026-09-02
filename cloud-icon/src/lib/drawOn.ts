/**
 * Polyline draw-on: reveal a path by stroking progressively along its length.
 *
 * Works on any point list, in any coordinate space, and is a pure function of
 * the progress value you pass — no internal state, so it renders identically
 * whatever order frames arrive in.
 */

export type Point = { x: number; y: number };

/** Cumulative length at each point; the last entry is the total path length. */
export const cumulativeLengths = (points: readonly Point[]): number[] => {
  const cumulative: number[] = [0];
  for (let i = 1; i < points.length; i++) {
    cumulative.push(
      cumulative[i - 1] + Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y),
    );
  }
  return cumulative;
};

/**
 * Strokes `points` revealed to `progress` (0-1) of the path's length.
 *
 * Pass `cumulative` when you already have it (from `cumulativeLengths`) to
 * avoid recomputing it every frame.
 */
export const strokePolylineTo = (
  ctx: CanvasRenderingContext2D,
  points: readonly Point[],
  progress: number,
  cumulative?: readonly number[],
) => {
  if (points.length < 2) return;
  const lengths = cumulative ?? cumulativeLengths(points);
  const total = lengths[lengths.length - 1];
  const target = total * Math.max(0, Math.min(1, progress));
  if (target <= 0) return;

  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i++) {
    const segStart = lengths[i - 1];
    const segEnd = lengths[i];
    if (target >= segEnd) {
      ctx.lineTo(points[i].x, points[i].y);
      continue;
    }
    const f = segEnd === segStart ? 1 : (target - segStart) / (segEnd - segStart);
    ctx.lineTo(
      points[i - 1].x + (points[i].x - points[i - 1].x) * f,
      points[i - 1].y + (points[i].y - points[i - 1].y) * f,
    );
    break;
  }
  ctx.stroke();
};

/** How far along the path (0-1) a given vertex sits. */
export const vertexProgress = (cumulative: readonly number[], index: number): number => {
  const total = cumulative[cumulative.length - 1];
  return total === 0 ? 0 : cumulative[index] / total;
};
