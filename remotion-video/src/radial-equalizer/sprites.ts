/**
 * Cached, pre-tinted sprites.
 *
 * Rounded capsule paths are expensive to re-draw thousands of times per frame,
 * and canvas has no tint-on-draw, so every element shape is baked once per
 * colour bucket and per softness tier and then blitted with `drawImage`.
 *
 * Softness stands in for radial blur: near-centre elements use the crisp tier,
 * outer ones use progressively blurrier sprites, which is what sells speed
 * without moving a camera.
 */

import { COLOR_BUCKETS, SOFTNESS_LEVELS } from "./constants";
import { buildBuckets, Palette } from "./palette";

export const CAPSULE_W = 320;
export const CAPSULE_H = 104;
export const DOT_SIZE = 128;
export const GLOW_SIZE = 160;

/** Blur radius, in sprite pixels, for each softness tier. */
const BLUR = [2, 4.5, 9];

export type SpriteSet = {
  /** [softness][bucket] */
  capsule: HTMLCanvasElement[][];
  outline: HTMLCanvasElement[][];
  dot: HTMLCanvasElement[][];
  /** [bucket] */
  glow: HTMLCanvasElement[];
  colors: string[];
};

const makeCanvas = (w: number, h: number) => {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return c;
};

const roundedRectPath = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
) => {
  const r = h / 2;
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.arc(x + w - r, y + r, r, -Math.PI / 2, Math.PI / 2);
  ctx.lineTo(x + r, y + h);
  ctx.arc(x + r, y + r, r, Math.PI / 2, -Math.PI / 2);
  ctx.closePath();
};

const baseCapsule = (blur: number, stroke: boolean) => {
  const c = makeCanvas(CAPSULE_W, CAPSULE_H);
  const ctx = c.getContext("2d") as CanvasRenderingContext2D;
  const pad = blur * 2 + 8;
  ctx.filter = `blur(${blur}px)`;
  ctx.fillStyle = "#fff";
  ctx.strokeStyle = "#fff";
  if (stroke) {
    ctx.lineWidth = CAPSULE_H * 0.15;
    roundedRectPath(
      ctx,
      pad + ctx.lineWidth / 2,
      pad + ctx.lineWidth / 2,
      CAPSULE_W - 2 * pad - ctx.lineWidth,
      CAPSULE_H - 2 * pad - ctx.lineWidth,
    );
    ctx.stroke();
  } else {
    roundedRectPath(ctx, pad, pad, CAPSULE_W - 2 * pad, CAPSULE_H - 2 * pad);
    ctx.fill();
  }
  return c;
};

const baseDot = (blur: number) => {
  const c = makeCanvas(DOT_SIZE, DOT_SIZE);
  const ctx = c.getContext("2d") as CanvasRenderingContext2D;
  const r = DOT_SIZE / 2 - blur * 2 - 4;
  ctx.filter = `blur(${blur}px)`;
  ctx.fillStyle = "#fff";
  ctx.beginPath();
  ctx.arc(DOT_SIZE / 2, DOT_SIZE / 2, r, 0, Math.PI * 2);
  ctx.fill();
  return c;
};

const baseGlow = () => {
  const c = makeCanvas(GLOW_SIZE, GLOW_SIZE);
  const ctx = c.getContext("2d") as CanvasRenderingContext2D;
  const g = ctx.createRadialGradient(
    GLOW_SIZE / 2,
    GLOW_SIZE / 2,
    0,
    GLOW_SIZE / 2,
    GLOW_SIZE / 2,
    GLOW_SIZE / 2,
  );
  g.addColorStop(0, "rgba(255,255,255,1)");
  g.addColorStop(0.28, "rgba(255,255,255,0.34)");
  g.addColorStop(0.6, "rgba(255,255,255,0.07)");
  g.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, GLOW_SIZE, GLOW_SIZE);
  return c;
};

const tint = (base: HTMLCanvasElement, color: string) => {
  const c = makeCanvas(base.width, base.height);
  const ctx = c.getContext("2d") as CanvasRenderingContext2D;
  ctx.drawImage(base, 0, 0);
  ctx.globalCompositeOperation = "source-in";
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, c.width, c.height);
  return c;
};

const tintAll = (base: HTMLCanvasElement, colors: string[]) =>
  colors.map((color) => tint(base, color));

const cache = new Map<string, SpriteSet>();

export const getSprites = (palette: Palette): SpriteSet => {
  const hit = cache.get(palette.id);
  if (hit) {
    return hit;
  }
  const colors = buildBuckets(palette);
  const capsule: HTMLCanvasElement[][] = [];
  const outline: HTMLCanvasElement[][] = [];
  const dot: HTMLCanvasElement[][] = [];
  for (let s = 0; s < SOFTNESS_LEVELS; s++) {
    capsule.push(tintAll(baseCapsule(BLUR[s], false), colors));
    outline.push(tintAll(baseCapsule(BLUR[s], true), colors));
    dot.push(tintAll(baseDot(BLUR[s]), colors));
  }
  const set: SpriteSet = {
    capsule,
    outline,
    dot,
    glow: tintAll(baseGlow(), colors),
    colors,
  };
  if (colors.length !== COLOR_BUCKETS) {
    throw new Error(`expected ${COLOR_BUCKETS} colour buckets`);
  }
  cache.set(palette.id, set);
  return set;
};
