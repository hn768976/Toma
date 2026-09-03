/**
 * Path builders for the skewed bar.
 *
 * `roundedPolygon` takes arbitrary corner points rather than an
 * x/y/w/h rect, because the bar is deliberately a parallelogram: its
 * left edge is vertical but its right edge leans. A `roundRect` would
 * give away that this is a default UI element.
 */
export type Point = { x: number; y: number };

export const roundedPolygon = (
  ctx: CanvasRenderingContext2D,
  points: Point[],
  radius: number,
): void => {
  ctx.beginPath();
  const n = points.length;
  for (let i = 0; i < n; i++) {
    const prev = points[(i - 1 + n) % n];
    const curr = points[i];
    const next = points[(i + 1) % n];

    const toPrev = { x: prev.x - curr.x, y: prev.y - curr.y };
    const toNext = { x: next.x - curr.x, y: next.y - curr.y };
    const lenPrev = Math.hypot(toPrev.x, toPrev.y) || 1;
    const lenNext = Math.hypot(toNext.x, toNext.y) || 1;
    const r = Math.min(radius, lenPrev / 2, lenNext / 2);

    const start = {
      x: curr.x + (toPrev.x / lenPrev) * r,
      y: curr.y + (toPrev.y / lenPrev) * r,
    };
    const end = {
      x: curr.x + (toNext.x / lenNext) * r,
      y: curr.y + (toNext.y / lenNext) * r,
    };

    if (i === 0) {
      ctx.moveTo(start.x, start.y);
    } else {
      ctx.lineTo(start.x, start.y);
    }
    ctx.quadraticCurveTo(curr.x, curr.y, end.x, end.y);
  }
  ctx.closePath();
};

/**
 * The four corners of a leaning bar of width `w` and height `h` whose
 * top edge is pushed `skew` further right than its bottom edge.
 */
export const leaningRect = (
  x: number,
  y: number,
  w: number,
  h: number,
  skew: number,
): Point[] => [
  { x, y },
  { x: x + w + skew, y },
  { x: x + w, y: y + h },
  { x, y: y + h },
];
