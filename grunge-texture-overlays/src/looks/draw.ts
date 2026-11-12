import { chance, gauss, int, range, type Rng } from "../lib/rng";
import type { Frame } from "./types";

export type Pt = [number, number];

/** A path in card px that wanders slightly: start, heading (radians, 0 = right, PI/2 = down), length. */
export const wanderPath = (
  r: Rng,
  x: number,
  y: number,
  heading: number,
  length: number,
  step: number,
  turn: number,
  hook = 0,
): Pt[] => {
  const pts: Pt[] = [[x, y]];
  const n = Math.max(2, Math.ceil(length / step));
  let a = heading;
  let da = 0;
  for (let i = 1; i <= n; i++) {
    const t = i / n;
    da += gauss(r) * turn;
    da *= 0.85;
    a += da + (t > 0.7 ? hook * (t - 0.7) * 3.3 / n * 4 : 0);
    x += Math.cos(a) * (length / n);
    y += Math.sin(a) * (length / n);
    pts.push([x, y]);
  }
  return pts;
};

/**
 * Stroke a path as a scratch: broken into runs (some gaps), brightness varying run to run,
 * tapering at both ends. ctx strokeStyle should already be set (white for ink).
 */
export const brokenStroke = (
  ctx: CanvasRenderingContext2D,
  r: Rng,
  pts: Pt[],
  width: number,
  alpha: number,
  gapChance = 0.12,
) => {
  const n = pts.length - 1;
  let i = 0;
  while (i < n) {
    const run = int(r, 2, 9);
    const on = !chance(r, gapChance);
    const end = Math.min(n, i + run);
    if (on) {
      const t = (i + end) / 2 / n;
      const taper = Math.min(1, Math.sin(Math.PI * Math.min(1, Math.max(0, t))) * 1.8 + 0.15);
      const a = alpha * taper * range(r, 0.55, 1);
      const w = width * (0.6 + 0.4 * taper) * range(r, 0.8, 1.15);
      const pw = Math.max(w, 1);
      ctx.globalAlpha = Math.min(1, a * (w / pw));
      ctx.lineWidth = pw;
      ctx.beginPath();
      ctx.moveTo(pts[i][0], pts[i][1]);
      for (let k = i + 1; k <= end; k++) ctx.lineTo(pts[k][0], pts[k][1]);
      ctx.stroke();
    }
    i = end;
  }
  ctx.globalAlpha = 1;
};

/** Smooth thin curve (hair / fibre) through a few wandering control points. */
export const curlyHair = (ctx: CanvasRenderingContext2D, r: Rng, F: Frame, x: number, y: number, len: number, curl: number, width: number, alpha: number) => {
  const pts = wanderPath(r, x, y, range(r, 0, Math.PI * 2), len, len / 14, curl);
  ctx.globalAlpha = alpha;
  ctx.lineWidth = Math.max(width, 1);
  if (width < 1) ctx.globalAlpha = alpha * width;
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length - 1; i++) {
    const mx = (pts[i][0] + pts[i + 1][0]) / 2;
    const my = (pts[i][1] + pts[i + 1][1]) / 2;
    ctx.quadraticCurveTo(pts[i][0], pts[i][1], mx, my);
  }
  ctx.stroke();
  ctx.globalAlpha = 1;
  void F;
};

/** Short tapered flick (pencil flick / fleck). */
export const flick = (ctx: CanvasRenderingContext2D, r: Rng, x: number, y: number, a: number, len: number, width: number, alpha: number) => {
  const steps = 6;
  for (let i = 0; i < steps; i++) {
    const t0 = i / steps;
    const t1 = (i + 1) / steps;
    const bend = 0.15 * Math.sin(t0 * Math.PI);
    const w = width * (1 - t0 * 0.85);
    ctx.globalAlpha = alpha * (1 - t0 * 0.6) * (w < 1 ? w : 1);
    ctx.lineWidth = Math.max(1, w);
    ctx.beginPath();
    ctx.moveTo(x + Math.cos(a + bend) * len * t0, y + Math.sin(a + bend) * len * t0);
    ctx.lineTo(x + Math.cos(a + bend) * len * t1, y + Math.sin(a + bend) * len * t1);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  void r;
};

/** Grainy streak: many thin, nearly parallel lines with random alpha (a charcoal/toner streak). */
export const grainyStreak = (
  ctx: CanvasRenderingContext2D,
  r: Rng,
  x: number,
  y: number,
  heading: number,
  len: number,
  width: number,
  alpha: number,
  u: number,
) => {
  const n = Math.max(6, Math.round(width / (0.9 * u)));
  const nx = -Math.sin(heading);
  const ny = Math.cos(heading);
  for (let i = 0; i < n; i++) {
    const o = (i / (n - 1) - 0.5) * width + gauss(r) * 0.3 * u;
    const edge = 1 - Math.pow(Math.abs(i / (n - 1) - 0.5) * 2, 2);
    const s0 = range(r, 0, 0.25) * len;
    const s1 = len - range(r, 0, 0.3) * len;
    const pts = wanderPath(r, x + nx * o + Math.cos(heading) * s0, y + ny * o + Math.sin(heading) * s0, heading, s1 - s0, 6 * u, 0.002);
    brokenStroke(ctx, r, pts, range(r, 0.6, 1.4) * u, alpha * edge * range(r, 0.3, 1), 0.3);
  }
};
