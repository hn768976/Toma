import { clamp, rnd, rndRange } from "../random/seeded";

// Palette-agnostic canvas drawing primitives. Colours, sizes and counts all
// arrive as arguments; nothing here knows about any particular project's
// palette or layout.

export const roundedRectPath = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number | number[],
) => {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r as number | DOMPointInit[]);
};

/**
 * Splits a span of `total` units into `count` dashes of irregular but
 * deterministic length and spacing — the "hand-cut" look real HUD chrome has,
 * where a rule is drawn as a run of unequal ticks rather than a CSS dash
 * pattern.
 *
 * Returns absolute [start, length] pairs measured from 0.
 */
export const irregularDashes = (
  seed: string,
  total: number,
  count: number,
  minFrac = 0.25,
  maxFrac = 1,
): { start: number; length: number }[] => {
  const slot = total / count;
  const out: { start: number; length: number }[] = [];
  for (let i = 0; i < count; i++) {
    const length = slot * rndRange(`${seed}-len-${i}`, minFrac, maxFrac);
    const start = i * slot + (slot - length) * rndRange(`${seed}-off-${i}`, 0, 1);
    out.push({ start, length });
  }
  return out;
};

/**
 * Deterministic scatter of points in a polar annulus. `radiusBias` > 1 pushes
 * points outwards, < 1 pulls them in; the sqrt at 1 gives an even area
 * distribution rather than the centre-heavy clumping of a naive uniform radius.
 */
export const radialPlaces = (
  seed: string,
  count: number,
  rMin: number,
  rMax: number,
  angleFrom = 0,
  angleTo = Math.PI * 2,
  radiusBias = 1,
): { angle: number; radius: number; x: number; y: number }[] => {
  const out = [];
  for (let i = 0; i < count; i++) {
    const angle = rndRange(`${seed}-a-${i}`, angleFrom, angleTo);
    const t = Math.pow(rnd(`${seed}-r-${i}`), 1 / (2 * radiusBias));
    const radius = rMin + (rMax - rMin) * t;
    out.push({
      angle,
      radius,
      x: Math.cos(angle) * radius,
      y: Math.sin(angle) * radius,
    });
  }
  return out;
};

/**
 * A ring of fine radial ticks. Every `majorEvery`-th tick is drawn longer and
 * in `majorColor`. Centred on (cx, cy); ticks grow outwards from `radius`.
 */
export const tickRing = (
  ctx: CanvasRenderingContext2D,
  opts: {
    cx: number;
    cy: number;
    radius: number;
    count: number;
    length: number;
    width: number;
    color: string;
    majorEvery?: number;
    majorLength?: number;
    majorColor?: string;
    majorWidth?: number;
    from?: number;
    to?: number;
  },
) => {
  const {
    cx,
    cy,
    radius,
    count,
    length,
    width,
    color,
    majorEvery = 0,
    majorLength = length * 1.8,
    majorColor = color,
    majorWidth = width,
    from = 0,
    to = Math.PI * 2,
  } = opts;
  const span = to - from;
  const closed = Math.abs(span - Math.PI * 2) < 1e-6;
  for (let i = 0; i < count; i++) {
    const a = from + (span * i) / (closed ? count : Math.max(1, count - 1));
    const major = majorEvery > 0 && i % majorEvery === 0;
    const len = major ? majorLength : length;
    ctx.beginPath();
    ctx.strokeStyle = major ? majorColor : color;
    ctx.lineWidth = major ? majorWidth : width;
    ctx.moveTo(cx + Math.cos(a) * radius, cy + Math.sin(a) * radius);
    ctx.lineTo(cx + Math.cos(a) * (radius + len), cy + Math.sin(a) * (radius + len));
    ctx.stroke();
  }
};

/**
 * A circle drawn as a run of unequal arc fragments with gaps — reads as a
 * technical ring rather than a plain stroked circle.
 */
export const brokenArcRing = (
  ctx: CanvasRenderingContext2D,
  opts: {
    cx: number;
    cy: number;
    radius: number;
    width: number;
    color: string;
    seed: string;
    pieces?: number;
    minFrac?: number;
    maxFrac?: number;
    cap?: CanvasLineCap;
  },
) => {
  const {
    cx,
    cy,
    radius,
    width,
    color,
    seed,
    pieces = 7,
    minFrac = 0.3,
    maxFrac = 0.92,
    cap = "butt",
  } = opts;
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = cap;
  for (const d of irregularDashes(seed, Math.PI * 2, pieces, minFrac, maxFrac)) {
    ctx.beginPath();
    ctx.arc(cx, cy, radius, d.start, d.start + d.length);
    ctx.stroke();
  }
  ctx.lineCap = "butt";
};

/**
 * Reveals a stroked path progressively, "drawn on" from its start.
 * `progress` 0 -> nothing, 1 -> the whole path. `pathLength` is the caller's
 * measure of the path (an arc's r*theta, a polyline's summed segments).
 */
export const drawOn = (
  ctx: CanvasRenderingContext2D,
  pathLength: number,
  progress: number,
) => {
  const p = clamp(progress, 0, 1);
  ctx.setLineDash([pathLength, pathLength]);
  ctx.lineDashOffset = pathLength * (1 - p);
};

export const clearDrawOn = (ctx: CanvasRenderingContext2D) => {
  ctx.setLineDash([]);
  ctx.lineDashOffset = 0;
};

/**
 * Glow helper. Canvas shadows are the cheapest per-object bloom available and
 * are what "panels barely bloom" is built from — the heavy bloom on the centre
 * element is a separate blurred compositing pass.
 */
export const withGlow = (
  ctx: CanvasRenderingContext2D,
  color: string,
  blur: number,
  body: () => void,
) => {
  ctx.save();
  ctx.shadowColor = color;
  ctx.shadowBlur = blur;
  body();
  ctx.restore();
};
