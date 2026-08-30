import { random } from "remotion";
import { DURATION } from "../theme";

/** Every value in the piece comes from here — never Math.random(). */
export const rnd = (seed: string) => random(seed);

export const rndRange = (seed: string, a: number, b: number) =>
  a + random(seed) * (b - a);

/** Inclusive of both ends. */
export const rndInt = (seed: string, a: number, b: number) =>
  a + Math.floor(random(seed) * (b - a + 1));

export const pick = <T>(seed: string, arr: readonly T[]): T =>
  arr[Math.floor(random(seed) * arr.length)] as T;

export const rndBool = (seed: string, p = 0.5) => random(seed) < p;

/** Frame position inside the loop. Everything animated derives from this. */
export const loopFrame = (frame: number) =>
  ((frame % DURATION) + DURATION) % DURATION;

/** Phase in [0,1) across the loop. */
export const loopPhase = (frame: number) => loopFrame(frame) / DURATION;

/**
 * A value that cycles through `600 / period` distinct indices per loop and is
 * therefore identical at frame 0 and frame 600. `phase` staggers cells so they
 * do not all reroll on the same frame.
 */
export const cycleIndex = (frame: number, period: number, phase: number) =>
  Math.floor(((loopFrame(frame) + phase) % DURATION) / period);

/** Periods that divide 600 exactly, so every reroll schedule closes the loop. */
export const REROLL_PERIODS = [75, 100, 120, 150, 200, 300] as const;

/**
 * Half-pixel alignment. Odd stroke widths straddle a pixel boundary, so an
 * axis-aligned line at an integer coordinate renders as two grey rows instead
 * of one crisp one.
 */
export const align = (v: number, lineWidth: number) =>
  lineWidth % 2 === 0 ? Math.round(v) : Math.round(v) + 0.5;

export const hLine = (
  ctx: CanvasRenderingContext2D,
  x1: number,
  x2: number,
  y: number,
) => {
  const yy = align(y, ctx.lineWidth);
  ctx.beginPath();
  ctx.moveTo(Math.round(x1), yy);
  ctx.lineTo(Math.round(x2), yy);
  ctx.stroke();
};

export const vLine = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y1: number,
  y2: number,
) => {
  const xx = align(x, ctx.lineWidth);
  ctx.beginPath();
  ctx.moveTo(xx, Math.round(y1));
  ctx.lineTo(xx, Math.round(y2));
  ctx.stroke();
};

export const line = (
  ctx: CanvasRenderingContext2D,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
) => {
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
};

export const circle = (
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number,
) => {
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.stroke();
};

export const dot = (
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number,
) => {
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();
};

export const strokeRect = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
) => {
  const lw = ctx.lineWidth;
  ctx.strokeRect(align(x, lw), align(y, lw), Math.round(w), Math.round(h));
};

/** An offscreen canvas for chrome that is drawn once and blitted every frame. */
export const makeCanvas = (w: number, h: number) => {
  const c = document.createElement("canvas");
  c.width = Math.max(1, Math.ceil(w));
  c.height = Math.max(1, Math.ceil(h));
  return c;
};

export const ctxOf = (c: HTMLCanvasElement) => {
  const ctx = c.getContext("2d");
  if (!ctx) {
    throw new Error("2d context unavailable");
  }
  return ctx;
};

/** Trim a segment so it starts and ends on the two circles' circumferences. */
export const trimToCircles = (
  x1: number,
  y1: number,
  r1: number,
  x2: number,
  y2: number,
  r2: number,
) => {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len;
  const uy = dy / len;
  return {
    x1: x1 + ux * r1,
    y1: y1 + uy * r1,
    x2: x2 - ux * r2,
    y2: y2 - uy * r2,
    len: len - r1 - r2,
  };
};

/**
 * A closed Lissajous path: integer frequencies mean the position at frame 600
 * is exactly the position at frame 0.
 */
export const closedDrift = (
  frame: number,
  ax: number,
  ay: number,
  kx: number,
  ky: number,
  px: number,
  py: number,
) => {
  const t = loopPhase(frame) * Math.PI * 2;
  return {
    dx: ax * Math.sin(kx * t + px),
    dy: ay * Math.sin(ky * t + py),
  };
};
