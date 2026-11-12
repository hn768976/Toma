import { chance, gauss, range, type Rng } from "../lib/rng";
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
  // Brightness and width vary smoothly along the line (a few random sine components) instead of in
  // blocks; the line breaks where that variation dips low, so gaps have uneven lengths.
  const n = pts.length - 1;
  const ph = [range(r, 0, 6.28), range(r, 0, 6.28), range(r, 0, 6.28)];
  const fr = [range(r, 0.5, 1.5), range(r, 2, 5), range(r, 6, 14)];
  const gapLevel = gapChance * 1.4;
  ctx.lineCap = "butt";
  for (let i = 0; i < n; i++) {
    const t = (i + 0.5) / n;
    const v = 0.5 + 0.22 * Math.sin(ph[0] + t * fr[0] * 6.28) + 0.18 * Math.sin(ph[1] + t * fr[1] * 6.28) + 0.1 * Math.sin(ph[2] + t * fr[2] * 6.28);
    if (v < gapLevel) continue;
    const taper = Math.min(1, Math.sin(Math.PI * t) * 2.2 + 0.1);
    const k = Math.min(1, (v - gapLevel) / 0.25);
    const w = width * (0.55 + 0.6 * v) * (0.6 + 0.4 * taper);
    const pw = Math.max(w, 1);
    ctx.globalAlpha = Math.min(1, alpha * k * taper * (0.5 + 0.6 * v) * (w / pw));
    ctx.lineWidth = pw;
    ctx.beginPath();
    ctx.moveTo(pts[i][0], pts[i][1]);
    ctx.lineTo(pts[i + 1][0], pts[i + 1][1]);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
};

/** Smooth thin curve (hair / fibre) through a few wandering control points. */
export const curlyHair = (ctx: CanvasRenderingContext2D, r: Rng, F: Frame, x: number, y: number, len: number, curl: number, width: number, alpha: number) => {
  // Irregular fibre: curl strength changes along the hair, width and darkness taper and waver,
  // and a faint second pass gives it a slightly fuzzy edge.
  const n = 40;
  const pts: Pt[] = [[x, y]];
  let a = range(r, 0, Math.PI * 2);
  let da = gauss(r) * curl * 1.8;
  for (let i = 1; i <= n; i++) {
    if (chance(r, 0.1)) da = gauss(r) * curl * 2.4; // kinks / changes of curl
    da += gauss(r) * curl * 0.6;
    da *= 0.97;
    a += da;
    x += Math.cos(a) * (len / n);
    y += Math.sin(a) * (len / n);
    pts.push([x, y]);
  }
  const wph = range(r, 0, 6.28);
  ctx.lineCap = "round";
  for (let pass = 0; pass < 2; pass++) {
    const off = pass === 0 ? 0 : 0.6 * F.u;
    for (let i = 0; i < n; i++) {
      const t = (i + 0.5) / n;
      const taper = Math.min(1, Math.sin(Math.PI * t) * 1.6 + 0.15);
      const w = width * taper * (0.75 + 0.35 * Math.sin(wph + t * 9));
      const pw = Math.max(w, 1);
      ctx.globalAlpha = Math.min(1, alpha * (pass === 0 ? 1 : 0.18) * (0.6 + 0.4 * taper) * (w / pw));
      ctx.lineWidth = pass === 0 ? pw : pw * 2;
      ctx.beginPath();
      ctx.moveTo(pts[i][0] + off, pts[i][1] + off);
      ctx.lineTo(pts[i + 1][0] + off, pts[i + 1][1] + off);
      ctx.stroke();
    }
  }
  ctx.globalAlpha = 1;
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
