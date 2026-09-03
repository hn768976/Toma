/** Canvas primitives shared by every panel. Nothing here reads the frame. */
import { useMemo } from "react";
import type { Palette, Rect } from "./types";
import { irregularPositions, rand } from "./rng";

/** #RRGGBB -> rgba() at the given alpha. Keeps palette hexes the only source. */
export const withAlpha = (hex: string, alpha: number) => {
  const h = hex.replace("#", "");
  const n = parseInt(h, 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
};

/** An offscreen canvas built once and blitted every frame after that. */
export const useOffscreen = (
  w: number,
  h: number,
  draw: (ctx: CanvasRenderingContext2D) => void,
  deps: unknown[],
): HTMLCanvasElement =>
  useMemo(() => {
    const c = document.createElement("canvas");
    c.width = Math.max(1, Math.round(w));
    c.height = Math.max(1, Math.round(h));
    draw(c.getContext("2d")!);
    return c;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

/** A run of dashes with irregular lengths and gaps. */
export const irregularDashes = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  seed: string,
  color: string,
  thickness = 3,
) => {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = thickness;
  let cursor = 0;
  let i = 0;
  while (cursor < width) {
    const len = rand(`${seed}-len-${i}`, 10, 62);
    const gap = rand(`${seed}-gap-${i}`, 8, 40);
    const end = Math.min(width, cursor + len);
    ctx.beginPath();
    ctx.moveTo(x + cursor, y);
    ctx.lineTo(x + end, y);
    ctx.stroke();
    cursor = end + gap;
    i++;
  }
  ctx.restore();
};

/** A thin ring with fine radial ticks, optionally broken into arcs. */
export const tickRing = (
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  radius: number,
  color: string,
  opts: {
    ticks?: number;
    tickLength?: number;
    thickness?: number;
    /** Number of gaps to cut out of the ring itself. */
    breaks?: number;
    seed?: string;
    everyNthLong?: number;
  } = {},
) => {
  const {
    ticks = 72,
    tickLength = 12,
    thickness = 2,
    breaks = 0,
    seed = "ring",
    everyNthLong = 6,
  } = opts;

  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = thickness;

  if (breaks <= 0) {
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.stroke();
  } else {
    // Irregular arcs with gaps between them — a broken outer ring.
    const starts = irregularPositions(`${seed}-arc`, breaks, 0, Math.PI * 2, 0.9);
    for (let i = 0; i < starts.length; i++) {
      const a0 = starts[i];
      const next = i === starts.length - 1 ? starts[0] + Math.PI * 2 : starts[i + 1];
      const gap = rand(`${seed}-gap-${i}`, 0.06, 0.3);
      ctx.beginPath();
      ctx.arc(cx, cy, radius, a0 + gap, next - gap * 0.4);
      ctx.stroke();
    }
  }

  for (let i = 0; i < ticks; i++) {
    const a = (i / ticks) * Math.PI * 2;
    const len = i % everyNthLong === 0 ? tickLength * 1.9 : tickLength;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(a) * radius, cy + Math.sin(a) * radius);
    ctx.lineTo(cx + Math.cos(a) * (radius + len), cy + Math.sin(a) * (radius + len));
    ctx.stroke();
  }
  ctx.restore();
};

/** A small crosshair mark. */
export const crosshair = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  color: string,
  size = 18,
) => {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(x - size, y);
  ctx.lineTo(x + size, y);
  ctx.moveTo(x, y - size);
  ctx.lineTo(x, y + size);
  ctx.stroke();
  ctx.restore();
};

/**
 * The chrome every panel shares: thin border, small corner ticks, tiny label
 * strip. Drawn in panel-local coordinates so it can be cached offscreen.
 */
export const panelChrome = (
  ctx: CanvasRenderingContext2D,
  rect: Rect,
  palette: Palette,
  label: string,
  fonts: { mono: (s: number, w?: number) => string; sans: (s: number, w?: number) => string },
) => {
  const { w, h } = rect;
  ctx.save();

  ctx.fillStyle = withAlpha(palette.panelFill, palette.panelFillAlpha);
  ctx.fillRect(0, 0, w, h);

  ctx.strokeStyle = withAlpha(palette.panelBorder, 0.85);
  ctx.lineWidth = 2.5;
  ctx.strokeRect(1.25, 1.25, w - 2.5, h - 2.5);

  // Corner ticks, sitting just inside the border.
  const t = 26;
  const inset = 12;
  ctx.strokeStyle = palette.panelBorder;
  ctx.lineWidth = 4;
  const corners: [number, number, number, number][] = [
    [inset, inset, 1, 1],
    [w - inset, inset, -1, 1],
    [inset, h - inset, 1, -1],
    [w - inset, h - inset, -1, -1],
  ];
  for (const [cx, cy, sx, sy] of corners) {
    ctx.beginPath();
    ctx.moveTo(cx + sx * t, cy);
    ctx.lineTo(cx, cy);
    ctx.lineTo(cx, cy + sy * t);
    ctx.stroke();
  }

  // Tiny label strip.
  ctx.fillStyle = withAlpha(palette.panelBorder, 0.3);
  ctx.fillRect(inset, h - inset - 30, 190, 30);
  ctx.fillStyle = palette.textPale;
  ctx.font = fonts.sans(21, 600);
  ctx.textBaseline = "middle";
  ctx.letterSpacing = "3px";
  ctx.fillText(label, inset + 10, h - inset - 14);
  ctx.letterSpacing = "0px";

  ctx.restore();
};
