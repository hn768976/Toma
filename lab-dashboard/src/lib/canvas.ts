import type { Rect } from "../layout";

export type Ctx = CanvasRenderingContext2D;

/** Parse "#RRGGBB" once and hand back an rgba() string at the given alpha. */
export const withAlpha = (hex: string, alpha: number): string => {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

/** Linear blend between two "#RRGGBB" colours. */
export const mix = (a: string, b: string, t: number): string => {
  const pa = [1, 3, 5].map((i) => parseInt(a.slice(i, i + 2), 16));
  const pb = [1, 3, 5].map((i) => parseInt(b.slice(i, i + 2), 16));
  const c = pa.map((v, i) =>
    Math.max(0, Math.min(255, Math.round(v + (pb[i] - v) * t))),
  );
  return `#${c.map((v) => v.toString(16).padStart(2, "0")).join("")}`;
};

/** Reset the shared context so no component can leak state into the next. */
export const resetCtx = (ctx: Ctx): void => {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = "source-over";
  ctx.shadowBlur = 0;
  ctx.shadowColor = "rgba(0,0,0,0)";
  ctx.filter = "none";
  ctx.lineWidth = 1;
  ctx.lineCap = "butt";
  ctx.lineJoin = "miter";
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.letterSpacing = "0px";
};

export const clipRect = (ctx: Ctx, r: Rect): void => {
  ctx.beginPath();
  ctx.rect(r.x, r.y, r.w, r.h);
  ctx.clip();
};

/** Crisp hairline rect: offset by half the stroke so 2px lands on 2px. */
export const strokeRect = (
  ctx: Ctx,
  r: Rect,
  color: string,
  width: number,
): void => {
  const h = width / 2;
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.strokeRect(r.x + h, r.y + h, r.w - width, r.h - width);
};

/** The small L-shaped ticks that sit inside each panel corner. */
export const cornerTicks = (
  ctx: Ctx,
  r: Rect,
  color: string,
  len: number,
  width: number,
): void => {
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  const inset = 10;
  const corners: readonly (readonly [number, number, number, number])[] = [
    [r.x + inset, r.y + inset, 1, 1],
    [r.x + r.w - inset, r.y + inset, -1, 1],
    [r.x + inset, r.y + r.h - inset, 1, -1],
    [r.x + r.w - inset, r.y + r.h - inset, -1, -1],
  ];
  for (const [cx, cy, sx, sy] of corners) {
    ctx.beginPath();
    ctx.moveTo(cx + sx * len, cy);
    ctx.lineTo(cx, cy);
    ctx.lineTo(cx, cy + sy * len);
    ctx.stroke();
  }
};

export type FontSpec = { family: string; size: number; weight?: number };

export const setFont = (ctx: Ctx, f: FontSpec, tracking = 0): void => {
  ctx.font = `${f.weight ?? 400} ${f.size}px ${f.family}`;
  ctx.letterSpacing = `${tracking}px`;
};

/**
 * Draw a number with a fixed advance per glyph — canvas has no access to a
 * font's tabular-figure feature, so the advance is imposed here instead.
 * Without this the big readouts shuffle sideways every time a digit changes.
 */
export const drawTabular = (
  ctx: Ctx,
  text: string,
  x: number,
  y: number,
  align: "left" | "right",
): void => {
  let cell = 0;
  for (let d = 0; d < 10; d++) {
    cell = Math.max(cell, ctx.measureText(String(d)).width);
  }
  const total = text.length * cell;
  let cursor = align === "right" ? x - total : x;
  const prevAlign = ctx.textAlign;
  ctx.textAlign = "center";
  for (const ch of text) {
    ctx.fillText(ch, cursor + cell / 2, y);
    cursor += cell;
  }
  ctx.textAlign = prevAlign;
};

/** Width the tabular renderer will occupy for a string of n digits. */
export const tabularWidth = (ctx: Ctx, n: number): number => {
  let cell = 0;
  for (let d = 0; d < 10; d++) {
    cell = Math.max(cell, ctx.measureText(String(d)).width);
  }
  return cell * n;
};

/**
 * Cheap additive bloom for line art: the same path restroked wide and faint
 * in `lighter` mode. Far quicker than shadowBlur over a 3600-point polyline
 * and, at 4K, indistinguishable from it.
 */
export const bloomStroke = (
  ctx: Ctx,
  path: () => void,
  color: string,
  coreWidth: number,
  amount: number,
): void => {
  ctx.save();
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  ctx.globalCompositeOperation = "lighter";
  ctx.strokeStyle = withAlpha(color, 0.055 * amount);
  ctx.lineWidth = coreWidth * 7;
  path();
  ctx.stroke();
  ctx.strokeStyle = withAlpha(color, 0.11 * amount);
  ctx.lineWidth = coreWidth * 3.1;
  path();
  ctx.stroke();
  ctx.restore();

  ctx.save();
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  ctx.strokeStyle = color;
  ctx.lineWidth = coreWidth;
  path();
  ctx.stroke();
  ctx.restore();
};

/** Bloom for a handful of large glyphs — shadowBlur is fine at this count. */
export const bloomText = (
  ctx: Ctx,
  draw: () => void,
  color: string,
  blur: number,
): void => {
  ctx.save();
  ctx.shadowColor = color;
  ctx.shadowBlur = blur;
  draw();
  ctx.shadowBlur = blur * 0.45;
  draw();
  ctx.restore();
  draw();
};
