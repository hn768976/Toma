import { alpha, type Ctx2D } from "./paint";
import { r, rInt } from "./rand";
import type { Palette } from "./variants";

/**
 * The finishing pass: bloom on the accent-coloured elements, a vignette, fine
 * scanlines and grain. Everything here is a pure function of the frame number.
 */

export const VIGNETTE_STRENGTH = 0.18;
export const SCANLINE_ALPHA = 0.03;
export const SCANLINE_SPACING = 5;
export const GRAIN_ALPHA = 0.04;
const GRAIN_TILE = 512;
const GRAIN_TILES = 12;

const makeCanvas = (w: number, h: number) => {
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  return canvas;
};

/** Fast deterministic PRNG, seeded from Remotion's random() so the noise tiles
 *  are stable across machines and renders. */
const mulberry32 = (seed: number) => {
  let t = seed >>> 0;
  return () => {
    t = (t + 0x6d2b79f5) >>> 0;
    let x = Math.imul(t ^ (t >>> 15), 1 | t);
    x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x;
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
};

/** A small pool of grain tiles, generated once and picked per frame. */
export const makeGrainTiles = (): HTMLCanvasElement[] => {
  const tiles: HTMLCanvasElement[] = [];
  for (let t = 0; t < GRAIN_TILES; t++) {
    const canvas = makeCanvas(GRAIN_TILE, GRAIN_TILE);
    const ctx = canvas.getContext("2d") as Ctx2D;
    const image = ctx.createImageData(GRAIN_TILE, GRAIN_TILE);
    const rnd = mulberry32(Math.floor(r(`grain-tile:${t}`) * 2 ** 32));
    const data = image.data;
    for (let i = 0; i < data.length; i += 4) {
      const value = (rnd() * 255) | 0;
      data[i] = value;
      data[i + 1] = value;
      data[i + 2] = value;
      data[i + 3] = 255;
    }
    ctx.putImageData(image, 0, 0);
    tiles.push(canvas);
  }
  return tiles;
};

/** A 1 x SCANLINE_SPACING pattern tile, tiled across the frame. */
export const makeScanlinePattern = (ctx: Ctx2D, palette: Palette): CanvasPattern => {
  const canvas = makeCanvas(1, SCANLINE_SPACING);
  const c = canvas.getContext("2d") as Ctx2D;
  c.fillStyle = alpha(palette.shadow, 1);
  c.fillRect(0, 0, 1, 1);
  return ctx.createPattern(canvas, "repeat") as CanvasPattern;
};

export type FinishBuffers = {
  glow: HTMLCanvasElement;
  glowCtx: Ctx2D;
  blur: HTMLCanvasElement;
  blurCtx: Ctx2D;
  grain: HTMLCanvasElement[];
};

export const createFinishBuffers = (w: number, h: number): FinishBuffers => {
  // The bloom buffer runs at half resolution - the blur hides the difference
  // and it quarters the cost of the most expensive pass in the frame.
  const glow = makeCanvas(w / 2, h / 2);
  const blur = makeCanvas(w / 2, h / 2);
  return {
    glow,
    glowCtx: glow.getContext("2d") as Ctx2D,
    blur,
    blurCtx: blur.getContext("2d") as Ctx2D,
    grain: makeGrainTiles(),
  };
};

/** Clear the bloom buffer and restore its half-resolution transform. */
export const resetGlow = (buffers: FinishBuffers, w: number, h: number) => {
  const c = buffers.glowCtx;
  c.setTransform(1, 0, 0, 1, 0, 0);
  c.clearRect(0, 0, w / 2, h / 2);
  c.setTransform(0.5, 0, 0, 0.5, 0, 0);
};

/** Blur the bloom buffer twice and add it back over the frame. */
export const compositeBloom = (
  ctx: Ctx2D,
  buffers: FinishBuffers,
  w: number,
  h: number,
) => {
  const passes: [number, number][] = [
    [6, 0.42],
    [20, 0.26],
  ];
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  for (const [radius, strength] of passes) {
    const b = buffers.blurCtx;
    b.setTransform(1, 0, 0, 1, 0, 0);
    b.clearRect(0, 0, w / 2, h / 2);
    b.filter = `blur(${radius}px)`;
    b.drawImage(buffers.glow, 0, 0);
    b.filter = "none";
    ctx.globalAlpha = strength;
    ctx.drawImage(buffers.blur, 0, 0, w, h);
  }
  ctx.restore();
};

export const drawVignette = (ctx: Ctx2D, w: number, h: number, palette: Palette) => {
  const gradient = ctx.createRadialGradient(
    w / 2,
    h / 2,
    Math.min(w, h) * 0.3,
    w / 2,
    h / 2,
    Math.hypot(w, h) * 0.58,
  );
  gradient.addColorStop(0, alpha(palette.shadow, 0));
  gradient.addColorStop(0.6, alpha(palette.shadow, VIGNETTE_STRENGTH * 0.45));
  gradient.addColorStop(1, alpha(palette.shadow, VIGNETTE_STRENGTH));
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, w, h);
};

export const drawScanlines = (
  ctx: Ctx2D,
  pattern: CanvasPattern,
  w: number,
  h: number,
) => {
  ctx.save();
  ctx.globalAlpha = SCANLINE_ALPHA;
  ctx.fillStyle = pattern;
  ctx.fillRect(0, 0, w, h);
  ctx.restore();
};

export const drawGrain = (
  ctx: Ctx2D,
  buffers: FinishBuffers,
  frame: number,
  w: number,
  h: number,
) => {
  const tile = buffers.grain[rInt(`grain:${frame}`, 0, buffers.grain.length)];
  const ox = rInt(`grain-x:${frame}`, 0, GRAIN_TILE);
  const oy = rInt(`grain-y:${frame}`, 0, GRAIN_TILE);
  ctx.save();
  ctx.globalAlpha = GRAIN_ALPHA;
  ctx.globalCompositeOperation = "overlay";
  for (let x = -ox; x < w; x += GRAIN_TILE) {
    for (let y = -oy; y < h; y += GRAIN_TILE) {
      ctx.drawImage(tile, x, y);
    }
  }
  ctx.restore();
};
