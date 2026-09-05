// Cached offscreen sprites. Built once, lazily, on first draw: per-dot
// arc()/gradient calls would be far too slow at 34k dots x 4K x 300
// frames, and the sparkle cross has to be identical every frame anyway.

import {
  GRAIN_TILE_COUNT,
  GRAIN_TILE_SIZE,
  SEED_GRAIN,
  type Palette,
} from "./constants";
import { mulberry32 } from "./random";

const makeCanvas = (w: number, h: number) => {
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  return canvas;
};

const rgba = (c: [number, number, number], a: number) =>
  `rgba(${c[0]}, ${c[1]}, ${c[2]}, ${a})`;

// --- Sparkle -------------------------------------------------------------
// A soft core plus a 4-point cross. Bloom lives here and ONLY here: a
// general bloom pass would fuse the dots into a haze, and the discrete
// dots are the product.
const SPRITE_SIZE = 256;

const sparkleCache = new Map<string, HTMLCanvasElement>();

export const getSparkleSprite = (
  color: [number, number, number],
): HTMLCanvasElement => {
  const key = color.join(",");
  const cached = sparkleCache.get(key);
  if (cached) {
    return cached;
  }

  const canvas = makeCanvas(SPRITE_SIZE, SPRITE_SIZE);
  const ctx = canvas.getContext("2d")!;
  const c = SPRITE_SIZE / 2;
  ctx.globalCompositeOperation = "lighter";

  // Restrained bloom around the core.
  const glow = ctx.createRadialGradient(c, c, 0, c, c, SPRITE_SIZE * 0.24);
  glow.addColorStop(0, rgba(color, 0.5));
  glow.addColorStop(0.18, rgba(color, 0.16));
  glow.addColorStop(0.45, rgba(color, 0.035));
  glow.addColorStop(1, rgba(color, 0));
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, SPRITE_SIZE, SPRITE_SIZE);

  // Four arms, each tapering to nothing at the sprite edge.
  const arm = SPRITE_SIZE * 0.5;
  const thickness = SPRITE_SIZE * 0.016;
  for (let axis = 0; axis < 2; axis++) {
    const grad =
      axis === 0
        ? ctx.createLinearGradient(c - arm, 0, c + arm, 0)
        : ctx.createLinearGradient(0, c - arm, 0, c + arm);
    grad.addColorStop(0, rgba(color, 0));
    grad.addColorStop(0.34, rgba(color, 0.1));
    grad.addColorStop(0.47, rgba(color, 0.75));
    grad.addColorStop(0.5, rgba(color, 1));
    grad.addColorStop(0.53, rgba(color, 0.75));
    grad.addColorStop(0.66, rgba(color, 0.1));
    grad.addColorStop(1, rgba(color, 0));
    ctx.fillStyle = grad;
    if (axis === 0) {
      ctx.fillRect(c - arm, c - thickness / 2, arm * 2, thickness);
    } else {
      ctx.fillRect(c - thickness / 2, c - arm, thickness, arm * 2);
    }
  }

  // Bright core, clipping towards white.
  const core = ctx.createRadialGradient(c, c, 0, c, c, SPRITE_SIZE * 0.055);
  // A neutral-white core would drag the whole field pale; keep the hot
  // centre only a step lighter than the sparkle colour itself.
  core.addColorStop(0, rgba([
    Math.min(255, color[0] + 30),
    Math.min(255, color[1] + 22),
    Math.min(255, color[2] + 14),
  ], 1));
  core.addColorStop(0.4, rgba(color, 0.7));
  core.addColorStop(1, rgba(color, 0));
  ctx.fillStyle = core;
  ctx.fillRect(0, 0, SPRITE_SIZE, SPRITE_SIZE);

  sparkleCache.set(key, canvas);
  return canvas;
};

// --- Grain ---------------------------------------------------------------
// Additive white noise. A pure black field bands around the disc's glow
// without it. Tiles are cycled per frame; the cycle length divides the
// loop, so the grain is seamless too.
let grainTiles: HTMLCanvasElement[] | null = null;

export const getGrainTiles = (): HTMLCanvasElement[] => {
  if (grainTiles) {
    return grainTiles;
  }
  const rand = mulberry32(SEED_GRAIN);
  const tiles: HTMLCanvasElement[] = [];
  for (let t = 0; t < GRAIN_TILE_COUNT; t++) {
    const canvas = makeCanvas(GRAIN_TILE_SIZE, GRAIN_TILE_SIZE);
    const ctx = canvas.getContext("2d")!;
    const image = ctx.createImageData(GRAIN_TILE_SIZE, GRAIN_TILE_SIZE);
    const data = image.data;
    for (let i = 0; i < GRAIN_TILE_SIZE * GRAIN_TILE_SIZE; i++) {
      const v = rand();
      const o = i * 4;
      data[o] = 255;
      data[o + 1] = 255;
      data[o + 2] = 255;
      // Squared, so the bulk of the grain sits near zero and only a
      // sparse minority actually lifts a pixel.
      data[o + 3] = (v * v * 255) | 0;
    }
    ctx.putImageData(image, 0, 0);
    tiles.push(canvas);
  }
  grainTiles = tiles;
  return tiles;
};

// --- Background lift -----------------------------------------------------
// A very faint annulus where the disc is densest. Not a glow pass —
// just enough to stop the field sitting on dead black.
const glowCache = new WeakMap<
  CanvasRenderingContext2D,
  Map<string, CanvasGradient>
>();

export const getBackgroundLift = (
  ctx: CanvasRenderingContext2D,
  palette: Palette,
  cx: number,
  cy: number,
  height: number,
): CanvasGradient => {
  let perCtx = glowCache.get(ctx);
  if (!perCtx) {
    perCtx = new Map();
    glowCache.set(ctx, perCtx);
  }
  const key = `${palette.glow.join(",")}|${cx}|${cy}|${height}`;
  const cached = perCtx.get(key);
  if (cached) {
    return cached;
  }
  const s = palette.glowStrength;
  const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, height * 0.9);
  // Nothing inside the hole: it has to stay dead black.
  grad.addColorStop(0, rgba(palette.glow, 0));
  grad.addColorStop(0.2, rgba(palette.glow, 0));
  grad.addColorStop(0.44, rgba(palette.glow, s));
  grad.addColorStop(0.72, rgba(palette.glow, s * 0.4));
  grad.addColorStop(1, rgba(palette.glow, 0));
  perCtx.set(key, grad);
  return grad;
};

