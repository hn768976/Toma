import { random } from "remotion";
import {
  CENTER_X,
  CENTER_Y,
  GLOW_SCALE,
  GRAIN_TILE,
  GRAIN_TILE_COUNT,
  GLOW_ALPHA,
  HEIGHT,
  PARTICLE_COLOR_MIX,
  VIGNETTE_ALPHA,
  VIGNETTE_RADIUS,
  WIDTH,
} from "./config";
import { rgba, rgbOf, solid, type PaletteKey, type Variant } from "./theme";

export const createCanvas = (w: number, h: number): HTMLCanvasElement => {
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  return canvas;
};

/**
 * The background: a plain blue gradient with a large soft dark radial vignette
 * slightly above frame centre. No texture of its own — the grains and the fine
 * grain overlay carry all the detail, and the smooth field is what lets them
 * read. Entirely static, so it is built once and blitted.
 */
export const buildBackgroundTexture = (
  variant: Variant,
): HTMLCanvasElement => {
  const canvas = createCanvas(WIDTH, HEIGHT);
  const ctx = canvas.getContext("2d");
  if (!ctx) return canvas;

  const deep = rgbOf(variant, "backgroundDeep");
  const mid = rgbOf(variant, "backgroundMid");
  const dark = rgbOf(variant, "backgroundDark");

  // A slow diagonal gradient, brighter toward the top-left, so the field has
  // direction without ever calling attention to itself.
  const field = ctx.createLinearGradient(0, 0, WIDTH, HEIGHT);
  field.addColorStop(0, solid(mid));
  field.addColorStop(0.55, solid(deep));
  field.addColorStop(1, solid(deep));
  ctx.fillStyle = field;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  // The dark centre. Bright particles only read because of this.
  const vignette = ctx.createRadialGradient(
    CENTER_X,
    CENTER_Y,
    0,
    CENTER_X,
    CENTER_Y,
    VIGNETTE_RADIUS,
  );
  vignette.addColorStop(0, rgba(dark, VIGNETTE_ALPHA));
  vignette.addColorStop(0.3, rgba(dark, VIGNETTE_ALPHA * 0.78));
  vignette.addColorStop(0.6, rgba(dark, VIGNETTE_ALPHA * 0.42));
  vignette.addColorStop(0.85, rgba(dark, VIGNETTE_ALPHA * 0.12));
  vignette.addColorStop(1, rgba(dark, 0));
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  return canvas;
};

const SPRITE_SIZE = 128;

/**
 * One pre-rendered soft glow per particle colour. Building the radial gradient
 * 2200+ times a frame would dominate the render; a scaled drawImage will not.
 */
export const buildGlowSprites = (
  variant: Variant,
): Record<string, HTMLCanvasElement> => {
  const sprites: Record<string, HTMLCanvasElement> = {};
  for (let i = 0; i < PARTICLE_COLOR_MIX.length; i++) {
    const key = PARTICLE_COLOR_MIX[i].key;
    const canvas = createCanvas(SPRITE_SIZE, SPRITE_SIZE);
    const ctx = canvas.getContext("2d");
    if (!ctx) continue;
    const rgb = rgbOf(variant, key);
    const r = SPRITE_SIZE / 2;
    const g = ctx.createRadialGradient(r, r, 0, r, r, r);
    g.addColorStop(0, rgba(rgb, GLOW_ALPHA));
    g.addColorStop(0.22, rgba(rgb, GLOW_ALPHA * 0.5));
    g.addColorStop(0.5, rgba(rgb, GLOW_ALPHA * 0.16));
    g.addColorStop(1, rgba(rgb, 0));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, SPRITE_SIZE, SPRITE_SIZE);
    sprites[key] = canvas;
  }
  return sprites;
};

export const glowScaleFor = (key: PaletteKey): number => GLOW_SCALE[key] ?? 3.5;

/**
 * Fine ± grain tiles. Several are baked so the swarm layer can cycle them by
 * frame — still a pure function of the frame number, but the grain moves.
 */
export const buildGrainTiles = (variant: Variant): HTMLCanvasElement[] => {
  const light = rgbOf(variant, "grain");
  const tiles: HTMLCanvasElement[] = [];
  for (let t = 0; t < GRAIN_TILE_COUNT; t++) {
    const canvas = createCanvas(GRAIN_TILE, GRAIN_TILE);
    const ctx = canvas.getContext("2d");
    if (!ctx) continue;
    const image = ctx.createImageData(GRAIN_TILE, GRAIN_TILE);
    const data = image.data;
    const pixels = GRAIN_TILE * GRAIN_TILE;
    for (let i = 0; i < pixels; i++) {
      const n = random(`grain-${t}-${i}`) * 2 - 1;
      const positive = n > 0;
      const o = i * 4;
      data[o] = positive ? light.r : 0;
      data[o + 1] = positive ? light.g : 0;
      data[o + 2] = positive ? light.b : 0;
      data[o + 3] = Math.abs(n) * 255;
    }
    ctx.putImageData(image, 0, 0);
    tiles.push(canvas);
  }
  return tiles;
};
