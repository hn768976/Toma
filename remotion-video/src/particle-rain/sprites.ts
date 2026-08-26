import { GRAIN_TILE_PX } from "./constants";
import { DOT_TONES, hexToRgb, rgba, type Theme } from "./themes";
import { rand } from "./random";

// Dots are drawn as pre-tinted sprites rather than per-dot arcs with
// shadowBlur or ctx.filter. Two reasons: canvas blur filters cost time
// proportional to the area they cover, which at 4K across thousands of dots
// is hopeless; and a blurred disc of a few px is, to a very good
// approximation, just a Gaussian blob — which is exactly what a radial
// gradient already is. So blur is expressed as *sprite choice and scale*,
// not as a filter.

const HALO_SPRITE_PX = 128;
const CORE_SPRITE_PX = 64;

export type ToneSprites = {
  /** Near-hard disc with a one-pixel-ish soft edge. */
  core: HTMLCanvasElement;
  /** Wide Gaussian-ish falloff, used for glow, blur and bloom. */
  halo: HTMLCanvasElement;
};

export type SpriteSet = {
  tones: ToneSprites[];
  grain: HTMLCanvasElement;
};

const createCanvas = (size: number): HTMLCanvasElement | null => {
  if (typeof document === "undefined") return null;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  return canvas;
};

const buildCore = (color: string): HTMLCanvasElement | null => {
  const canvas = createCanvas(CORE_SPRITE_PX);
  const ctx = canvas?.getContext("2d");
  if (!canvas || !ctx) return null;
  const r = CORE_SPRITE_PX / 2;
  const rgb = hexToRgb(color);
  const gradient = ctx.createRadialGradient(r, r, 0, r, r, r);
  gradient.addColorStop(0, rgba(rgb, 1));
  gradient.addColorStop(0.62, rgba(rgb, 1));
  gradient.addColorStop(0.82, rgba(rgb, 0.55));
  gradient.addColorStop(1, rgba(rgb, 0));
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, CORE_SPRITE_PX, CORE_SPRITE_PX);
  return canvas;
};

const buildHalo = (color: string): HTMLCanvasElement | null => {
  const canvas = createCanvas(HALO_SPRITE_PX);
  const ctx = canvas?.getContext("2d");
  if (!canvas || !ctx) return null;
  const r = HALO_SPRITE_PX / 2;
  const rgb = hexToRgb(color);
  const gradient = ctx.createRadialGradient(r, r, 0, r, r, r);
  gradient.addColorStop(0, rgba(rgb, 1));
  gradient.addColorStop(0.15, rgba(rgb, 0.72));
  gradient.addColorStop(0.3, rgba(rgb, 0.4));
  gradient.addColorStop(0.5, rgba(rgb, 0.14));
  gradient.addColorStop(0.72, rgba(rgb, 0.035));
  gradient.addColorStop(1, rgba(rgb, 0));
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, HALO_SPRITE_PX, HALO_SPRITE_PX);
  return canvas;
};

/**
 * One seeded monochrome noise tile. Per-frame variation comes from sliding
 * the pattern origin rather than regenerating the tile, which keeps the
 * grain free at render time and trivially loop-safe.
 */
const buildGrain = (): HTMLCanvasElement | null => {
  const canvas = createCanvas(GRAIN_TILE_PX);
  const ctx = canvas?.getContext("2d");
  if (!canvas || !ctx) return null;
  const image = ctx.createImageData(GRAIN_TILE_PX, GRAIN_TILE_PX);
  const data = image.data;
  for (let i = 0; i < data.length; i += 4) {
    const value = Math.round(rand(`rain-grain-${i}`) * 255);
    data[i] = value;
    data[i + 1] = value;
    data[i + 2] = value;
    data[i + 3] = 255;
  }
  ctx.putImageData(image, 0, 0);
  return canvas;
};

/** Returns null during server-side rendering, where there is no document to
 *  build the offscreen sprite canvases on. */
export const buildSprites = (theme: Theme): SpriteSet | null => {
  const grain = buildGrain();
  if (!grain) return null;

  const tones: ToneSprites[] = [];
  for (const key of DOT_TONES) {
    const core = buildCore(theme[key]);
    const halo = buildHalo(theme[key]);
    if (!core || !halo) return null;
    tones.push({ core, halo });
  }
  return { tones, grain };
};
