/**
 * Shared canvas helpers. Everything here works in DESIGN units — the renderer
 * has already applied the buffer scale to the context transform.
 */

import type { Palette } from "../../variants";
import type { DashboardAnimation } from "../timeline";
import type { Rect } from "../layout";
import { PANEL_RADIUS } from "../layout";

export type Ctx2D = CanvasRenderingContext2D;

export type PaintEnv = {
  /** The dashboard buffer itself. */
  ctx: Ctx2D;
  /**
   * A parallel buffer collecting only the things that should bloom — the three
   * line series and the counter numerals. It is blurred and added back in the
   * finishing pass.
   */
  glow: Ctx2D;
  palette: Palette;
  anim: DashboardAnimation;
  fontFamily: string;
  /** Buffer pixels per design unit. */
  scale: number;
  /** Backing-store size of the dashboard buffer, in real pixels. */
  bufferWidth: number;
  bufferHeight: number;
};

/**
 * A dashboard layer. Layers are painted in a fixed order by the renderer, which
 * keeps the composite deterministic — no effect ordering, no React commit
 * timing, the same result whether it is driving a screen or a texture.
 */
export type DashboardLayer = {
  name: string;
  paint: (env: PaintEnv) => void;
};

/** `#RRGGBB` plus an alpha, as `rgba()`. Hex only ever originates in variants.ts. */
export const withAlpha = (hex: string, alpha: number): string => {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

export const roundRectPath = (ctx: Ctx2D, r: Rect, radius = PANEL_RADIUS): void => {
  const rad = Math.min(radius, r.w / 2, r.h / 2);
  ctx.beginPath();
  ctx.moveTo(r.x + rad, r.y);
  ctx.arcTo(r.x + r.w, r.y, r.x + r.w, r.y + r.h, rad);
  ctx.arcTo(r.x + r.w, r.y + r.h, r.x, r.y + r.h, rad);
  ctx.arcTo(r.x, r.y + r.h, r.x, r.y, rad);
  ctx.arcTo(r.x, r.y, r.x + r.w, r.y, rad);
  ctx.closePath();
};

/** Dark semi-transparent fill with a thin border — the house panel style. */
export const drawPanel = (
  ctx: Ctx2D,
  palette: Palette,
  r: Rect,
  fillAlpha: number,
  radius = PANEL_RADIUS,
): void => {
  roundRectPath(ctx, r, radius);
  ctx.fillStyle = withAlpha(palette.panelFill, fillAlpha);
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = palette.panelBorder;
  ctx.stroke();
};

export type TextOptions = {
  size: number;
  weight?: number;
  color: string;
  align?: CanvasTextAlign;
  baseline?: CanvasTextBaseline;
  family: string;
  letterSpacing?: number;
};

export const fontString = (o: Pick<TextOptions, "size" | "weight" | "family">): string =>
  `${o.weight ?? 400} ${o.size}px ${o.family}, sans-serif`;

export const drawText = (ctx: Ctx2D, value: string, x: number, y: number, o: TextOptions): void => {
  ctx.save();
  ctx.font = fontString(o);
  ctx.fillStyle = o.color;
  ctx.textAlign = o.align ?? "left";
  ctx.textBaseline = o.baseline ?? "alphabetic";
  if (o.letterSpacing !== undefined && "letterSpacing" in ctx) {
    (ctx as Ctx2D & { letterSpacing: string }).letterSpacing = `${o.letterSpacing}px`;
  }
  ctx.fillText(value, x, y);
  ctx.restore();
};

const DIGITS = "0123456789";

/**
 * Canvas 2D gives no access to a font's `tnum` feature, so tabular figures are
 * produced here by hand: every digit is advanced on the same pitch (the widest
 * digit in the face) and centred in its slot, while non-digits keep their
 * natural advance. Counters therefore never jitter as their digits change, and
 * the layout is identical whichever font actually resolves.
 */
export const measureTabular = (ctx: Ctx2D, value: string, o: TextOptions): number => {
  ctx.save();
  ctx.font = fontString(o);
  let pitch = 0;
  for (const d of DIGITS) pitch = Math.max(pitch, ctx.measureText(d).width);
  let width = 0;
  for (const ch of value) {
    width += DIGITS.includes(ch) ? pitch : ctx.measureText(ch).width;
  }
  ctx.restore();
  return width;
};

export const drawTabular = (
  ctx: Ctx2D,
  value: string,
  x: number,
  y: number,
  o: TextOptions,
): number => {
  ctx.save();
  ctx.font = fontString(o);
  ctx.fillStyle = o.color;
  ctx.textBaseline = o.baseline ?? "alphabetic";
  ctx.textAlign = "left";

  let pitch = 0;
  for (const d of DIGITS) pitch = Math.max(pitch, ctx.measureText(d).width);

  const total = measureTabular(ctx, value, o);
  const align = o.align ?? "left";
  const cursorStart = align === "center" ? x - total / 2 : align === "right" ? x - total : x;
  let cursor = cursorStart;

  for (const ch of value) {
    if (DIGITS.includes(ch)) {
      const w = ctx.measureText(ch).width;
      ctx.fillText(ch, cursor + (pitch - w) / 2, y);
      cursor += pitch;
    } else {
      ctx.fillText(ch, cursor, y);
      cursor += ctx.measureText(ch).width;
    }
  }
  ctx.restore();
  return total;
};

/** Clip helper that always restores. */
export const clipped = (ctx: Ctx2D, r: Rect, radius: number, draw: () => void): void => {
  ctx.save();
  roundRectPath(ctx, r, radius);
  ctx.clip();
  draw();
  ctx.restore();
};

export const formatCounter = (value: number, format: "integer" | "percent" | "decimal"): string => {
  if (format === "integer") {
    return Math.round(value)
      .toString()
      .replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  }
  if (format === "percent") return `${value.toFixed(1)}%`;
  return value.toFixed(2);
};
