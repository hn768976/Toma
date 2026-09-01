/**
 * Canvas primitives shared by every component. No colour literals here —
 * callers pass colours in from the variant palette.
 */
import { alpha } from "./color";
import { fontOf } from "./font";
import type { Palette } from "../variants";

export type Ctx = CanvasRenderingContext2D;

export const px = (v: number): number => Math.round(v) + 0.5;

/* ------------------------------------------------------------------ text */

const zeroWidth = new Map<string, number>();

const cellWidth = (ctx: Ctx, font: string): number => {
  const hit = zeroWidth.get(font);
  if (hit !== undefined) {
    return hit;
  }
  const w = ctx.measureText("0").width;
  zeroWidth.set(font, w);
  return w;
};

export type TextOpts = {
  size: number;
  color: string;
  weight?: number;
  align?: "left" | "center" | "right";
  /** lay digits out on a fixed advance so readouts never jitter */
  tabular?: boolean;
  tracking?: number;
  baseline?: CanvasTextBaseline;
  opacity?: number;
};

/**
 * Draw text. With `tabular` every digit is placed in a fixed-width cell, which
 * gives true tabular figures regardless of what the loaded face defaults to.
 */
export const text = (
  ctx: Ctx,
  str: string,
  x: number,
  y: number,
  o: TextOpts,
): number => {
  const font = fontOf(o.size, o.weight ?? 500);
  ctx.save();
  ctx.font = font;
  ctx.fontKerning = "none";
  ctx.textBaseline = o.baseline ?? "middle";
  ctx.textAlign = "left";
  ctx.fillStyle = o.color;
  if (o.opacity !== undefined) {
    ctx.globalAlpha = o.opacity;
  }
  const tracking = o.tracking ?? 0;

  const chars = str.split("");
  const cell = o.tabular ? cellWidth(ctx, font) : 0;
  const widths = chars.map((c) =>
    o.tabular && c >= "0" && c <= "9" ? cell : ctx.measureText(c).width,
  );
  const total =
    widths.reduce((a, b) => a + b, 0) + tracking * Math.max(0, chars.length - 1);

  let cursor =
    o.align === "right" ? x - total : o.align === "center" ? x - total / 2 : x;

  for (let i = 0; i < chars.length; i++) {
    const w = widths[i];
    if (o.tabular && chars[i] >= "0" && chars[i] <= "9") {
      const glyph = ctx.measureText(chars[i]).width;
      ctx.fillText(chars[i], cursor + (w - glyph) / 2, y);
    } else {
      ctx.fillText(chars[i], cursor, y);
    }
    cursor += w + tracking;
  }
  ctx.restore();
  return total;
};

/* --------------------------------------------------------------- shapes */

export const line = (
  ctx: Ctx,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  color: string,
  width = 2,
  opacity = 1,
): void => {
  ctx.save();
  ctx.globalAlpha = opacity;
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
  ctx.restore();
};

export const arc = (
  ctx: Ctx,
  cx: number,
  cy: number,
  r: number,
  from: number,
  to: number,
  color: string,
  width: number,
  opacity = 1,
  cap: CanvasLineCap = "butt",
): void => {
  ctx.save();
  ctx.globalAlpha = opacity;
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = cap;
  ctx.beginPath();
  ctx.arc(cx, cy, r, from, to);
  ctx.stroke();
  ctx.restore();
};

export const ring = (
  ctx: Ctx,
  cx: number,
  cy: number,
  r: number,
  color: string,
  width = 2,
  opacity = 1,
): void => arc(ctx, cx, cy, r, 0, Math.PI * 2, color, width, opacity);

export const disc = (
  ctx: Ctx,
  cx: number,
  cy: number,
  r: number,
  color: string,
  opacity = 1,
): void => {
  ctx.save();
  ctx.globalAlpha = opacity;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
};

export const triangle = (
  ctx: Ctx,
  cx: number,
  cy: number,
  size: number,
  dir: 1 | -1,
  color: string,
  opacity = 1,
): void => {
  ctx.save();
  ctx.globalAlpha = opacity;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(cx - size, cy);
  ctx.lineTo(cx + size, cy);
  ctx.lineTo(cx, cy + size * 1.4 * dir);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
};

/** Regular polygon path (used for the amber variant's hexagons). */
export const polygonPath = (
  ctx: Ctx,
  cx: number,
  cy: number,
  r: number,
  sides: number,
  rotation: number,
): void => {
  ctx.beginPath();
  for (let i = 0; i < sides; i++) {
    const a = rotation + (i / sides) * Math.PI * 2;
    const x = cx + Math.cos(a) * r;
    const y = cy + Math.sin(a) * r;
    if (i === 0) {
      ctx.moveTo(x, y);
    } else {
      ctx.lineTo(x, y);
    }
  }
  ctx.closePath();
};

/** A small filled plate with a value in it — the HUD's caption chip. */
export const plate = (
  ctx: Ctx,
  cx: number,
  cy: number,
  label: string,
  size: number,
  p: Palette,
  fill = p.element,
): void => {
  const font = fontOf(size, 600);
  ctx.save();
  ctx.font = font;
  const w = ctx.measureText(label).width + size * 0.9;
  const h = size * 1.5;
  ctx.restore();
  ctx.save();
  ctx.fillStyle = alpha(fill, 0.9);
  ctx.fillRect(cx - w / 2, cy - h / 2, w, h);
  ctx.restore();
  text(ctx, label, cx, cy + 1, {
    size,
    color: p.textBright,
    weight: 600,
    align: "center",
    tabular: true,
    tracking: size * 0.04,
  });
};

/* ---------------------------------------------------------- panel chrome */

export const PANEL_STRIP_H = 40;

/**
 * The chrome every panel shares: 2px border, a label strip along the top edge
 * and tiny corner ticks. Static — rendered once into an offscreen canvas and
 * blitted every frame.
 */
export const panelChrome = (
  ctx: Ctx,
  w: number,
  h: number,
  label: string,
  code: string,
  p: Palette,
  textScale: number,
): void => {
  const strip = PANEL_STRIP_H * textScale;

  ctx.save();
  ctx.fillStyle = p.panelFill;
  ctx.fillRect(0, 0, w, h);
  ctx.restore();

  // 2px border
  ctx.save();
  ctx.strokeStyle = alpha(p.panelBorder, 0.85);
  ctx.lineWidth = 2;
  ctx.strokeRect(1, 1, w - 2, h - 2);
  ctx.restore();

  // label strip
  ctx.save();
  ctx.fillStyle = alpha(p.panelBorder, 0.22);
  ctx.fillRect(2, 2, w - 4, strip);
  ctx.restore();
  line(ctx, 2, px(2 + strip), w - 2, px(2 + strip), p.panelBorder, 2, 0.7);

  const ts = 24 * textScale;
  text(ctx, label, 16 * textScale, 2 + strip / 2, {
    size: ts,
    color: p.textPale,
    weight: 600,
    tracking: ts * 0.14,
  });
  text(ctx, code, w - 16 * textScale, 2 + strip / 2, {
    size: ts,
    color: alpha(p.textPale, 0.65),
    weight: 500,
    align: "right",
    tabular: true,
    tracking: ts * 0.1,
  });

  // corner ticks
  const t = 18;
  const c = alpha(p.pale, 0.75);
  const corners: [number, number, number, number][] = [
    [0, 0, 1, 1],
    [w, 0, -1, 1],
    [0, h, 1, -1],
    [w, h, -1, -1],
  ];
  for (const [cxp, cyp, sx, sy] of corners) {
    line(ctx, cxp + sx * 2, cyp + sy * 2, cxp + sx * (2 + t), cyp + sy * 2, c, 3);
    line(ctx, cxp + sx * 2, cyp + sy * 2, cxp + sx * 2, cyp + sy * (2 + t), c, 3);
  }
};

/** Content box inside a panel, below the label strip. */
export const panelBody = (
  w: number,
  h: number,
  textScale: number,
  pad = 22,
): { x: number; y: number; w: number; h: number } => {
  const strip = PANEL_STRIP_H * textScale + 2;
  return { x: pad, y: strip + pad * 0.7, w: w - pad * 2, h: h - strip - pad * 1.7 };
};
