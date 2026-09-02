/**
 * Fills a polyline as a ribbon whose half-width is given per vertex.
 *
 * A canvas stroke has a single `lineWidth` for the whole path, so a
 * filament that must thin to nothing along its length cannot be stroked —
 * it has to be drawn as a filled outline: walk the vertices offsetting by
 * the local normal on one side, then walk back down the other. Widths
 * arrive as an array parallel to the points so the caller owns the taper
 * curve.
 *
 * Coordinates are passed as parallel typed arrays rather than point
 * objects: this runs tens of thousands of times per frame and allocating
 * per-vertex objects there is pure garbage-collector pressure.
 */
export const fillTaperedPath = (
  ctx: CanvasRenderingContext2D,
  xs: Float64Array,
  ys: Float64Array,
  halfWidths: Float64Array,
  count: number,
  from = 0,
): void => {
  const n = count - from;
  if (n < 2) return;
  const last = count - 1;

  ctx.beginPath();
  for (let i = from; i < count; i++) {
    const a = Math.max(from, i - 1);
    const b = Math.min(last, i + 1);
    const dx = xs[b] - xs[a];
    const dy = ys[b] - ys[a];
    const len = Math.hypot(dx, dy) || 1;
    const nx = -dy / len;
    const ny = dx / len;
    const w = halfWidths[i];
    if (i === from) ctx.moveTo(xs[i] + nx * w, ys[i] + ny * w);
    else ctx.lineTo(xs[i] + nx * w, ys[i] + ny * w);
  }
  for (let i = last; i >= from; i--) {
    const a = Math.max(from, i - 1);
    const b = Math.min(last, i + 1);
    const dx = xs[b] - xs[a];
    const dy = ys[b] - ys[a];
    const len = Math.hypot(dx, dy) || 1;
    const nx = -dy / len;
    const ny = dx / len;
    const w = halfWidths[i];
    ctx.lineTo(xs[i] - nx * w, ys[i] - ny * w);
  }
  ctx.closePath();
  ctx.fill();
};
