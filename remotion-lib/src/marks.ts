import { withAlpha } from "./color";
import { rndBool, rndRange } from "./seeded";

/**
 * Small reusable HUD furniture: crosshairs, corner brackets, irregular dashed
 * rules and tick rings. Every colour is a parameter, and every seeded value
 * goes through `seeded`, so a mark drawn at frame 12 on worker 3 is identical
 * to the same mark on worker 1.
 *
 * All of these draw in whatever space the context's current transform
 * defines — pass them a plane-space context and they land on the plane.
 *
 * @module marks
 */

export const drawCrosshair = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  color: string,
  alpha = 0.7,
) => {
  ctx.strokeStyle = withAlpha(color, alpha);
  ctx.lineWidth = 2.2;
  ctx.beginPath();
  ctx.moveTo(x - r, y);
  ctx.lineTo(x - r * 0.32, y);
  ctx.moveTo(x + r * 0.32, y);
  ctx.lineTo(x + r, y);
  ctx.moveTo(x, y - r);
  ctx.lineTo(x, y - r * 0.32);
  ctx.moveTo(x, y + r * 0.32);
  ctx.lineTo(x, y + r);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(x, y, r * 0.26, 0, Math.PI * 2);
  ctx.stroke();
};

export const drawCornerBracket = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  arm: number,
  color: string,
  alpha = 0.75,
) => {
  ctx.strokeStyle = withAlpha(color, alpha);
  ctx.lineWidth = 3;
  const corners: [number, number, number, number][] = [
    [x, y, 1, 1],
    [x + w, y, -1, 1],
    [x, y + h, 1, -1],
    [x + w, y + h, -1, -1],
  ];
  for (const [cx, cy, sx, sy] of corners) {
    ctx.beginPath();
    ctx.moveTo(cx + sx * arm, cy);
    ctx.lineTo(cx, cy);
    ctx.lineTo(cx, cy + sy * arm);
    ctx.stroke();
  }
};

/**
 * A dashed rule whose dashes and gaps are seeded rather than uniform. A
 * uniform dash pattern reads as a border; an irregular one reads as data.
 */
export const irregularDashes = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  length: number,
  seed: string,
  color: string,
  opts: {
    vertical?: boolean;
    width?: number;
    alpha?: number;
    density?: number;
  } = {},
) => {
  const { vertical = false, width = 2.4, alpha = 0.6, density = 0.65 } = opts;
  ctx.strokeStyle = withAlpha(color, alpha);
  ctx.lineWidth = width;
  let t = 0;
  let i = 0;
  while (t < length) {
    const seg = Math.min(length - t, rndRange(`${seed}:seg:${i}`, 10, 46));
    if (rndBool(`${seed}:on:${i}`, density)) {
      ctx.beginPath();
      if (vertical) {
        ctx.moveTo(x, y + t);
        ctx.lineTo(x, y + t + seg);
      } else {
        ctx.moveTo(x + t, y);
        ctx.lineTo(x + t + seg, y);
      }
      ctx.stroke();
    }
    t += seg + rndRange(`${seed}:gap:${i}`, 6, 26);
    i++;
  }
};

/** A ring of radial ticks, every `majorEvery`-th one longer. */
export const tickRing = (
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  radius: number,
  count: number,
  majorEvery: number,
  color: string,
  opts: {
    alpha?: number;
    minor?: number;
    major?: number;
    startDeg?: number;
  } = {},
) => {
  const { alpha = 0.7, minor = 10, major = 22, startDeg = 0 } = opts;
  ctx.strokeStyle = withAlpha(color, alpha);
  for (let i = 0; i < count; i++) {
    const a = ((startDeg + (360 * i) / count) * Math.PI) / 180;
    const isMajor = i % majorEvery === 0;
    const len = isMajor ? major : minor;
    ctx.lineWidth = isMajor ? 3 : 1.8;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(a) * radius, cy + Math.sin(a) * radius);
    ctx.lineTo(
      cx + Math.cos(a) * (radius - len),
      cy + Math.sin(a) * (radius - len),
    );
    ctx.stroke();
  }
};
