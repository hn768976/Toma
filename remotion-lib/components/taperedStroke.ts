/**
 * Variable-width strokes on canvas.
 *
 * Canvas `lineWidth` is constant for a whole stroke, so a line that
 * thickens and thins along its length has to be drawn as a filled
 * polygon: walk the path, offset each point along its normal by half the
 * local width, and close the two sides into one shape. That is what
 * `taperedStroke` does. `taperedGradientStroke` additionally varies the
 * colour along the run, for travelling highlights and comet tails.
 *
 * @example
 * taperedStroke(ctx, path, {
 *   widthAt: (t) => 2 + 3 * Math.sin(Math.PI * t),   // fat in the middle
 *   fillStyle: "rgba(20,69,58,0.8)",
 * });
 */
import type { Path } from "./bezierPath";
import { indexAtArc, pointAtArc } from "./bezierPath";

type Pt = { x: number; y: number };

const normalAt = (pts: Pt[], i: number): Pt => {
  const a = pts[Math.max(0, i - 1)];
  const b = pts[Math.min(pts.length - 1, i + 1)];
  const tx = b.x - a.x;
  const ty = b.y - a.y;
  const len = Math.hypot(tx, ty) || 1;
  return { x: -ty / len, y: tx / len };
};

/**
 * Collects the polyline points covering arc fractions [from, to],
 * including exact interpolated endpoints so a sub-span starts and stops
 * where asked rather than snapping to the nearest sample.
 */
const spanPoints = (path: Path, from: number, to: number): { p: Pt; t: number }[] => {
  const lo = Math.max(0, Math.min(1, Math.min(from, to)));
  const hi = Math.max(0, Math.min(1, Math.max(from, to)));
  const iLo = indexAtArc(path, lo);
  const iHi = indexAtArc(path, hi);
  const out: { p: Pt; t: number }[] = [{ p: pointAtArc(path, lo), t: lo }];
  for (let i = iLo + 1; i <= iHi; i++) {
    out.push({ p: path.pts[i], t: path.length > 0 ? path.arc[i] / path.length : 0 });
  }
  out.push({ p: pointAtArc(path, hi), t: hi });
  return out;
};

const buildRibbon = (
  ctx: CanvasRenderingContext2D,
  samples: { p: Pt; t: number }[],
  normals: Pt[],
  widthAt: (t: number) => number,
) => {
  ctx.beginPath();
  for (let i = 0; i < samples.length; i++) {
    const h = Math.max(0.05, widthAt(samples[i].t) * 0.5);
    const x = samples[i].p.x + normals[i].x * h;
    const y = samples[i].p.y + normals[i].y * h;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  for (let i = samples.length - 1; i >= 0; i--) {
    const h = Math.max(0.05, widthAt(samples[i].t) * 0.5);
    ctx.lineTo(samples[i].p.x - normals[i].x * h, samples[i].p.y - normals[i].y * h);
  }
  ctx.closePath();
};

const normalsFor = (path: Path, samples: { p: Pt; t: number }[]): Pt[] => {
  const idx = samples.map((s) => indexAtArc(path, s.t));
  return idx.map((i) => normalAt(path.pts, i));
};

/**
 * Fills the path (or the arc-fraction sub-span [from, to]) as a single
 * shape whose half-width at arc fraction `t` is `widthAt(t) / 2`.
 */
export const taperedStroke = (
  ctx: CanvasRenderingContext2D,
  path: Path,
  opts: {
    widthAt: (t: number) => number;
    fillStyle: string;
    from?: number;
    to?: number;
    alpha?: number;
  },
): void => {
  const samples = spanPoints(path, opts.from ?? 0, opts.to ?? 1);
  if (samples.length < 2) return;
  const prevAlpha = ctx.globalAlpha;
  if (opts.alpha !== undefined) ctx.globalAlpha = prevAlpha * opts.alpha;
  buildRibbon(ctx, samples, normalsFor(path, samples), opts.widthAt);
  ctx.fillStyle = opts.fillStyle;
  ctx.fill();
  ctx.globalAlpha = prevAlpha;
};

/**
 * Draws a sub-span as one shape filled with a gradient along it, so
 * colour and alpha can vary over its length — the shape a travelling
 * highlight needs. `colorAt(u)` receives the position within the span
 * (0..1), not the position along the whole path.
 *
 * A single gradient-filled polygon rather than a run of quads: abutting
 * translucent quads composite twice wherever they overlap and leave a
 * seam wherever they do not, which reads as beading along the highlight.
 * The gradient axis is the chord of the span, which is accurate for the
 * short spans a highlight covers.
 */
export const taperedGradientStroke = (
  ctx: CanvasRenderingContext2D,
  path: Path,
  opts: {
    from: number;
    to: number;
    widthAt: (t: number) => number;
    colorAt: (u: number) => string;
    /** Number of colour stops sampled from `colorAt`. */
    stops?: number;
  },
): void => {
  const from = Math.max(0, Math.min(1, opts.from));
  const to = Math.max(0, Math.min(1, opts.to));
  if (to <= from) return;

  const samples = spanPoints(path, from, to);
  if (samples.length < 2) return;

  const a = pointAtArc(path, from);
  const b = pointAtArc(path, to);
  if (Math.hypot(b.x - a.x, b.y - a.y) < 0.01) return;

  buildRibbon(ctx, samples, normalsFor(path, samples), opts.widthAt);

  const stops = opts.stops ?? 16;
  const gradient = ctx.createLinearGradient(a.x, a.y, b.x, b.y);
  for (let i = 0; i <= stops; i++) {
    gradient.addColorStop(i / stops, opts.colorAt(i / stops));
  }
  ctx.fillStyle = gradient;
  ctx.fill();
};
