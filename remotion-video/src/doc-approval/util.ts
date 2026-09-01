import { random } from "remotion";

/** All randomness in this piece goes through Remotion's seeded `random`. */
export const rand = (seed: string): number => random(seed);

export const randRange = (seed: string, min: number, max: number): number =>
  min + random(seed) * (max - min);

export const randInt = (seed: string, min: number, maxExclusive: number): number =>
  min + Math.floor(random(seed) * (maxExclusive - min));

export const pick = <T,>(seed: string, items: readonly T[]): T =>
  items[Math.min(items.length - 1, Math.floor(random(seed) * items.length))];

/**
 * Creates a detached canvas used purely as an offscreen buffer. Returns null
 * during server-side evaluation, where `document` does not exist.
 */
export const createOffscreen = (
  width: number,
  height: number,
): HTMLCanvasElement | null => {
  if (typeof document === "undefined") return null;
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(width));
  canvas.height = Math.max(1, Math.round(height));
  return canvas;
};

export type Point = readonly [number, number];

const segmentLengths = (points: readonly Point[]): number[] => {
  const lengths: number[] = [];
  for (let i = 1; i < points.length; i++) {
    const dx = points[i][0] - points[i - 1][0];
    const dy = points[i][1] - points[i - 1][1];
    lengths.push(Math.hypot(dx, dy));
  }
  return lengths;
};

/**
 * Traces the first `progress` (0-1) of a polyline by arc length, so a
 * multi-segment stroke draws on at a constant speed rather than segment by
 * segment. Used for the checkmark's draw-on.
 */
export const tracePartialPolyline = (
  ctx: CanvasRenderingContext2D,
  points: readonly Point[],
  progress: number,
): void => {
  const lengths = segmentLengths(points);
  const total = lengths.reduce((a, b) => a + b, 0);
  let remaining = total * Math.max(0, Math.min(1, progress));
  ctx.beginPath();
  ctx.moveTo(points[0][0], points[0][1]);
  for (let i = 0; i < lengths.length; i++) {
    if (remaining <= 0) break;
    const t = Math.min(1, remaining / lengths[i]);
    const [x0, y0] = points[i];
    const [x1, y1] = points[i + 1];
    ctx.lineTo(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t);
    remaining -= lengths[i];
  }
};

/**
 * Draws text one glyph at a time so letter spacing is identical in every
 * Chrome build, rather than relying on `ctx.letterSpacing`.
 */
export const drawTrackedText = (
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  tracking: number,
  align: "left" | "right" | "center" = "left",
): void => {
  const widths = [...text].map((ch) => ctx.measureText(ch).width);
  const total =
    widths.reduce((a, b) => a + b, 0) + tracking * Math.max(0, text.length - 1);
  let cursor = x;
  if (align === "right") cursor = x - total;
  if (align === "center") cursor = x - total / 2;
  const previousAlign = ctx.textAlign;
  ctx.textAlign = "left";
  [...text].forEach((ch, i) => {
    ctx.fillText(ch, cursor, y);
    cursor += widths[i] + tracking;
  });
  ctx.textAlign = previousAlign;
};

/** Total advance width `drawTrackedText` would use, for underline rules. */
export const trackedTextWidth = (
  ctx: CanvasRenderingContext2D,
  text: string,
  tracking: number,
): number => {
  const widths = [...text].map((ch) => ctx.measureText(ch).width);
  return (
    widths.reduce((a, b) => a + b, 0) + tracking * Math.max(0, text.length - 1)
  );
};

/**
 * A closed Lissajous path. Both frequencies are whole numbers of cycles per
 * loop, so the position at frame `period` is exactly the position at frame 0.
 */
export const closedPathOffset = (
  frame: number,
  period: number,
  cyclesX: number,
  cyclesY: number,
  amplitudeX: number,
  amplitudeY: number,
  phase: number,
): { x: number; y: number } => {
  const t = (frame % period) / period;
  return {
    x: Math.sin(2 * Math.PI * (cyclesX * t + phase)) * amplitudeX,
    y: Math.sin(2 * Math.PI * (cyclesY * t + phase * 1.7) + Math.PI / 3) * amplitudeY,
  };
};

/** Converts `#RRGGBB` plus an alpha into an `rgba()` string. */
export const withAlpha = (hex: string, alpha: number): string => {
  const value = hex.replace("#", "");
  const r = parseInt(value.slice(0, 2), 16);
  const g = parseInt(value.slice(2, 4), 16);
  const b = parseInt(value.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};
