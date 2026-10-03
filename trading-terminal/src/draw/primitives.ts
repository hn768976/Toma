import { alpha, C, MONO, SANS } from "../theme";

/**
 * Every draw function runs twice per frame: once for the sharp screen
 * (glow=false) and once into a small bloom buffer (glow=true) where only
 * bright, light-emitting elements are drawn.
 */
export interface Painter {
  ctx: CanvasRenderingContext2D;
  glow: boolean;
}

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export type Pt = [number, number];

export const strokePath = (
  p: Painter,
  pts: Pt[],
  color: string,
  width: number,
  opts: { glow?: number; dash?: number[]; alpha?: number } = {},
) => {
  if (pts.length < 2) return;
  const { ctx } = p;
  const glow = opts.glow ?? 1;
  if (p.glow && glow <= 0) return;
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  ctx.strokeStyle = color;
  if (opts.dash) ctx.setLineDash(opts.dash);
  if (p.glow) {
    ctx.globalAlpha = 0.9 * glow;
    ctx.lineWidth = width * 2.2;
    ctx.stroke();
  } else {
    if (glow > 0) {
      ctx.globalAlpha = 0.16 * glow * (opts.alpha ?? 1);
      ctx.lineWidth = width * 3.2;
      ctx.stroke();
    }
    ctx.globalAlpha = opts.alpha ?? 1;
    ctx.lineWidth = width;
    ctx.stroke();
  }
  ctx.restore();
};

export const hline = (
  p: Painter,
  x0: number,
  x1: number,
  y: number,
  color: string,
  width = 1.5,
  dash?: number[],
) => {
  if (p.glow) return;
  const { ctx } = p;
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  if (dash) ctx.setLineDash(dash);
  ctx.beginPath();
  ctx.moveTo(x0, y);
  ctx.lineTo(x1, y);
  ctx.stroke();
  ctx.restore();
};

export const vline = (
  p: Painter,
  x: number,
  y0: number,
  y1: number,
  color: string,
  width = 1.5,
  dash?: number[],
) => {
  if (p.glow) return;
  const { ctx } = p;
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  if (dash) ctx.setLineDash(dash);
  ctx.beginPath();
  ctx.moveTo(x, y0);
  ctx.lineTo(x, y1);
  ctx.stroke();
  ctx.restore();
};

export const text = (
  p: Painter,
  s: string,
  x: number,
  y: number,
  size: number,
  color: string,
  opts: {
    align?: CanvasTextAlign;
    weight?: number;
    mono?: boolean;
    glow?: boolean;
    alpha?: number;
  } = {},
) => {
  if (p.glow && !opts.glow) return;
  const { ctx } = p;
  ctx.save();
  ctx.font = `${opts.weight ?? 500} ${size}px "${opts.mono ? MONO : SANS}"`;
  ctx.textAlign = opts.align ?? "left";
  ctx.textBaseline = "middle";
  ctx.fillStyle = color;
  ctx.globalAlpha = (opts.alpha ?? 1) * (p.glow ? 0.55 : 1);
  ctx.fillText(s, x, y);
  ctx.restore();
};

export const roundRect = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) => {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
};

/**
 * Monospace text whose changed digits roll vertically (odometer style).
 * prog 0 -> showing `prev`, 1 -> showing `next`.
 */
export const rollText = (
  p: Painter,
  prev: string,
  next: string,
  prog: number,
  x: number,
  y: number,
  size: number,
  color: string,
  opts: { align?: "left" | "right" | "center"; weight?: number; up?: boolean } = {},
) => {
  if (p.glow) return;
  const { ctx } = p;
  ctx.save();
  ctx.font = `${opts.weight ?? 600} ${size}px "${MONO}"`;
  ctx.textBaseline = "middle";
  ctx.textAlign = "left";
  ctx.fillStyle = color;
  const cw = ctx.measureText("0").width;
  const total = cw * next.length;
  const x0 =
    opts.align === "right" ? x - total : opts.align === "center" ? x - total / 2 : x;
  if (prev.length !== next.length || prog >= 1) {
    ctx.fillText(next, x0, y);
    ctx.restore();
    return;
  }
  const e = 1 - Math.pow(1 - Math.max(0, Math.min(1, prog)), 3);
  const travel = size * 1.05;
  const dir = opts.up === false ? -1 : 1;
  for (let i = 0; i < next.length; i++) {
    const cx = x0 + i * cw;
    if (prev[i] === next[i]) {
      ctx.fillText(next[i], cx, y);
      continue;
    }
    ctx.save();
    ctx.beginPath();
    ctx.rect(cx - 1, y - size * 0.62, cw + 2, size * 1.24);
    ctx.clip();
    ctx.globalAlpha = 1 - e;
    ctx.fillText(prev[i], cx, y - dir * e * travel);
    ctx.globalAlpha = e;
    ctx.fillText(next[i], cx, y + dir * (1 - e) * travel);
    ctx.restore();
  }
  ctx.restore();
};

export interface TagSpec {
  x: number;
  y: number;
  prev: string;
  next: string;
  prog: number;
  up?: boolean;
  color: string;
  size: number;
  filled?: boolean;
  align?: "left" | "right";
  /** Minimum width in characters. */
  minChars?: number;
}

/** Value tag: rounded box with rolling monospace digits. Returns its width. */
export const tag = (p: Painter, t: TagSpec) => {
  const { ctx } = p;
  ctx.save();
  ctx.font = `600 ${t.size}px "${MONO}"`;
  const cw = ctx.measureText("0").width;
  ctx.restore();
  const chars = Math.max(t.next.length, t.minChars ?? 0);
  const padX = t.size * 0.45;
  const w = chars * cw + padX * 2;
  const h = t.size * 1.45;
  const x = t.align === "right" ? t.x - w : t.x;
  const y = t.y - h / 2;
  ctx.save();
  roundRect(ctx, x, y, w, h, t.size * 0.18);
  if (t.filled) {
    ctx.fillStyle = t.color;
    ctx.globalAlpha = p.glow ? 0.55 : 1;
    ctx.fill();
  } else {
    ctx.fillStyle = p.glow ? "transparent" : alpha(C.bgDeep, 0.85);
    if (!p.glow) ctx.fill();
    ctx.strokeStyle = t.color;
    ctx.lineWidth = p.glow ? t.size * 0.18 : t.size * 0.1;
    ctx.globalAlpha = p.glow ? 0.7 : 1;
    ctx.stroke();
  }
  ctx.restore();
  rollText(p, t.prev, t.next, t.prog, x + w - padX, t.y, t.size, t.filled ? C.tagText : t.color, {
    align: "right",
    up: t.up,
  });
  return w;
};

export const niceStep = (range: number, target: number) => {
  const raw = range / Math.max(1, target);
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const n = raw / mag;
  const m = n < 1.5 ? 1 : n < 3 ? 2 : n < 7 ? 5 : 10;
  return m * mag;
};

export const panelFrame = (p: Painter, r: Rect, fill = C.panel) => {
  if (p.glow) return;
  const { ctx } = p;
  ctx.save();
  ctx.fillStyle = fill;
  ctx.fillRect(r.x, r.y, r.w, r.h);
  ctx.strokeStyle = C.line;
  ctx.lineWidth = 2;
  ctx.strokeRect(r.x, r.y, r.w, r.h);
  ctx.restore();
};
