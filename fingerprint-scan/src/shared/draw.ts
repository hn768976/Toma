/**
 * Canvas primitives for HUD-style chrome. All colour arrives as a parameter —
 * nothing here has a palette of its own.
 */
import { useMemo } from "react";
import { irregularPositions, rand } from "./rng";

/** #RRGGBB -> rgba() at the given alpha. */
export const withAlpha = (hex: string, alpha: number) => {
  const h = hex.replace("#", "");
  const n = parseInt(h, 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
};

/**
 * An offscreen canvas drawn once and blitted every frame after that. Use for
 * any chrome that does not change: it turns per-frame vector work into a single
 * drawImage.
 */
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

/** A horizontal run of dashes with seeded, irregular lengths and gaps. */
export const irregularDashes = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  seed: string,
  color: string,
  thickness = 3,
  lengthRange: [number, number] = [10, 62],
  gapRange: [number, number] = [8, 40],
) => {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = thickness;
  let cursor = 0;
  let i = 0;
  while (cursor < width) {
    const len = rand(`${seed}-len-${i}`, lengthRange[0], lengthRange[1]);
    const gap = rand(`${seed}-gap-${i}`, gapRange[0], gapRange[1]);
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

/**
 * A ring with fine radial ticks. Set `breaks` above zero to cut the ring itself
 * into irregular arcs — the "broken outer ring" of instrument-panel chrome.
 */
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

/** A small crosshair mark, for frame margins. */
export const crosshair = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  color: string,
  size = 18,
  thickness = 2.5,
) => {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = thickness;
  ctx.beginPath();
  ctx.moveTo(x - size, y);
  ctx.lineTo(x + size, y);
  ctx.moveTo(x, y - size);
  ctx.lineTo(x, y + size);
  ctx.stroke();
  ctx.restore();
};

export type PanelChromeColors = {
  fill: string;
  fillAlpha: number;
  border: string;
  label: string;
};

/**
 * The chrome shared by HUD panels: translucent fill, thin border, small corner
 * ticks and a tiny label strip. Drawn in panel-local coordinates (0,0 at the
 * panel's top-left) so it can be cached to an offscreen canvas.
 */
export const panelChrome = (
  ctx: CanvasRenderingContext2D,
  size: { w: number; h: number },
  colors: PanelChromeColors,
  label: string,
  labelFont: string,
  opts: { inset?: number; tick?: number; stripWidth?: number; stripHeight?: number } = {},
) => {
  const { w, h } = size;
  const { inset = 12, tick = 26, stripWidth = 190, stripHeight = 30 } = opts;
  ctx.save();

  ctx.fillStyle = withAlpha(colors.fill, colors.fillAlpha);
  ctx.fillRect(0, 0, w, h);

  ctx.strokeStyle = withAlpha(colors.border, 0.85);
  ctx.lineWidth = 2.5;
  ctx.strokeRect(1.25, 1.25, w - 2.5, h - 2.5);

  ctx.strokeStyle = colors.border;
  ctx.lineWidth = 4;
  const corners: [number, number, number, number][] = [
    [inset, inset, 1, 1],
    [w - inset, inset, -1, 1],
    [inset, h - inset, 1, -1],
    [w - inset, h - inset, -1, -1],
  ];
  for (const [cx, cy, sx, sy] of corners) {
    ctx.beginPath();
    ctx.moveTo(cx + sx * tick, cy);
    ctx.lineTo(cx, cy);
    ctx.lineTo(cx, cy + sy * tick);
    ctx.stroke();
  }

  ctx.fillStyle = withAlpha(colors.border, 0.3);
  ctx.fillRect(inset, h - inset - stripHeight, stripWidth, stripHeight);
  ctx.fillStyle = colors.label;
  ctx.font = labelFont;
  ctx.textBaseline = "middle";
  ctx.letterSpacing = "3px";
  ctx.fillText(label, inset + 10, h - inset - stripHeight / 2 + 1);
  ctx.letterSpacing = "0px";

  ctx.restore();
};
