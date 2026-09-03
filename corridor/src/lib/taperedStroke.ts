/**
 * Tapered polyline stroke.
 *
 * Draws a polyline as a single filled ribbon whose width varies per point and
 * whose opacity varies via a gradient laid along the chord of the curve — one
 * fill per stroke, no seams. Splitting the ribbon into constant-alpha bands is
 * the obvious implementation and the wrong one: under additive blending the
 * bands overlap at their shared vertices and stripe the strand.
 *
 * Colour is supplied by the caller as a builder, so this stays palette
 * agnostic and can taper anything.
 */

export interface TaperPoint {
  x: number;
  y: number;
  /** Full stroke width at this point, in pixels. */
  w: number;
  /** Opacity multiplier at this point, 0..1. */
  a: number;
}

export interface TaperedStrokeOptions {
  /** Builds a canvas colour from an opacity and the position along the curve. */
  colorAt: (alpha: number, t: number) => string;
  /** Number of gradient stops sampled along the curve. */
  stops?: number;
  /** Strokes whose peak opacity is below this are skipped entirely. */
  minAlpha?: number;
}

const normal = (pts: TaperPoint[], i: number): [number, number] => {
  const n = pts.length;
  const prev = pts[Math.max(0, i - 1)];
  const next = pts[Math.min(n - 1, i + 1)];
  let tx = next.x - prev.x;
  let ty = next.y - prev.y;
  const len = Math.hypot(tx, ty) || 1;
  tx /= len;
  ty /= len;
  return [-ty, tx];
};

export const taperedStroke = (
  ctx: CanvasRenderingContext2D,
  pts: TaperPoint[],
  opts: TaperedStrokeOptions,
): void => {
  const n = pts.length;
  if (n < 2) return;
  const minAlpha = opts.minAlpha ?? 0.004;

  let peak = 0;
  for (let i = 0; i < n; i++) if (pts[i].a > peak) peak = pts[i].a;
  if (peak < minAlpha) return;

  const x0 = pts[0].x;
  const y0 = pts[0].y;
  const dx = pts[n - 1].x - x0;
  const dy = pts[n - 1].y - y0;
  const chord2 = dx * dx + dy * dy;

  let fill: string | CanvasGradient;
  if (chord2 < 1) {
    let sum = 0;
    for (let i = 0; i < n; i++) sum += pts[i].a;
    fill = opts.colorAt(sum / n, 0.5);
  } else {
    const gradient = ctx.createLinearGradient(x0, y0, x0 + dx, y0 + dy);
    const stops = Math.max(2, Math.min(opts.stops ?? 12, n));
    let last = -1;
    for (let j = 0; j < stops; j++) {
      const i = Math.round((j * (n - 1)) / (stops - 1));
      const p = pts[i];
      // Project onto the chord so a curve that doubles back still produces
      // monotonically increasing stop positions.
      let pos = ((p.x - x0) * dx + (p.y - y0) * dy) / chord2;
      if (pos < 0) pos = 0;
      else if (pos > 1) pos = 1;
      if (j === 0) pos = 0;
      if (j === stops - 1) pos = 1;
      if (pos <= last) pos = Math.min(1, last + 1e-4);
      last = pos;
      gradient.addColorStop(pos, opts.colorAt(p.a, i / (n - 1)));
    }
    fill = gradient;
  }

  ctx.fillStyle = fill;
  ctx.beginPath();
  for (let i = 0; i < n; i++) {
    const p = pts[i];
    const [nx, ny] = normal(pts, i);
    const hw = Math.max(0.35, p.w) * 0.5;
    const px = p.x + nx * hw;
    const py = p.y + ny * hw;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  for (let i = n - 1; i >= 0; i--) {
    const p = pts[i];
    const [nx, ny] = normal(pts, i);
    const hw = Math.max(0.35, p.w) * 0.5;
    ctx.lineTo(p.x - nx * hw, p.y - ny * hw);
  }
  ctx.closePath();
  ctx.fill();
};
