// Cached sprite atlas. Every particle is one drawImage of a pre-rendered
// sprite scaled to size, rather than a canvas filter per element: a blur
// filter per particle would be unusably slow at 4K.

import {
  COLOR_BUCKETS,
  GRAIN_TILE_COUNT,
  GRAIN_TILE_SIZE,
  SOFTNESS_LEVELS,
  SPRITE_SIZE,
} from "./constants";
import { hexToRgb, mixRgb, Palette, Rgb, rgbaString, sampleRamp } from "./palettes";
import { mulberry32 } from "./random";

const createCanvas = (size: number): HTMLCanvasElement => {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  return canvas;
};

// A radial sprite whose falloff is set by `softness`: 0 is a crisp dot with a
// hairline halo, 1 is an out-of-focus smudge.
const makeDisc = (
  size: number,
  color: Rgb,
  softness: number,
  peakAlpha: number,
): HTMLCanvasElement => {
  const canvas = createCanvas(size);
  const ctx = canvas.getContext("2d") as CanvasRenderingContext2D;
  const r = size / 2;
  const core = 0.02 + 0.45 * (1 - softness);
  const gradient = ctx.createRadialGradient(r, r, 0, r, r, r);
  gradient.addColorStop(0, rgbaString(color, peakAlpha));
  gradient.addColorStop(core, rgbaString(color, peakAlpha));
  const falloff: [number, number][] = [
    [0.25, 0.5],
    [0.45, 0.22],
    [0.65, 0.08],
    [0.85, 0.02],
    [1, 0],
  ];
  for (const [f, a] of falloff) {
    gradient.addColorStop(core + (1 - core) * f, rgbaString(color, peakAlpha * a));
  }
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);
  return canvas;
};

// Four-point cross for sparkles: a bright core with two tapering spikes.
const makeCross = (size: number, color: Rgb): HTMLCanvasElement => {
  const canvas = createCanvas(size);
  const ctx = canvas.getContext("2d") as CanvasRenderingContext2D;
  const c = size / 2;
  ctx.globalCompositeOperation = "lighter";

  for (const vertical of [false, true]) {
    const gradient = vertical
      ? ctx.createLinearGradient(0, 0, 0, size)
      : ctx.createLinearGradient(0, 0, size, 0);
    gradient.addColorStop(0, rgbaString(color, 0));
    gradient.addColorStop(0.35, rgbaString(color, 0.35));
    gradient.addColorStop(0.5, rgbaString(color, 1));
    gradient.addColorStop(0.65, rgbaString(color, 0.35));
    gradient.addColorStop(1, rgbaString(color, 0));
    ctx.fillStyle = gradient;
    // Taper the spike by stacking three progressively shorter, thinner bars.
    for (const [lengthScale, thickness] of [
      [1, 0.035],
      [0.6, 0.07],
      [0.32, 0.14],
    ]) {
      const long = size * lengthScale;
      const thick = size * thickness;
      if (vertical) {
        ctx.fillRect(c - thick / 2, c - long / 2, thick, long);
      } else {
        ctx.fillRect(c - long / 2, c - thick / 2, long, thick);
      }
    }
  }

  // Core.
  const core = ctx.createRadialGradient(c, c, 0, c, c, size * 0.11);
  core.addColorStop(0, rgbaString(color, 1));
  core.addColorStop(1, rgbaString(color, 0));
  ctx.fillStyle = core;
  ctx.fillRect(0, 0, size, size);
  return canvas;
};

export type SpriteSet = {
  // [softnessLevel][colorBucket]
  discs: HTMLCanvasElement[][];
  // Large, very soft discs for bokeh, foreground blobs and bloom.
  bokeh: HTMLCanvasElement[];
  highlight: HTMLCanvasElement; // near-white soft disc (bloom + arc streaks)
  cross: HTMLCanvasElement;
};

export const BOKEH_TINTS = 4;

const spriteCache = new Map<string, SpriteSet>();

export const getSprites = (palette: Palette): SpriteSet => {
  const cached = spriteCache.get(palette.id);
  if (cached) {
    return cached;
  }

  const discs: HTMLCanvasElement[][] = [];
  for (let s = 0; s < SOFTNESS_LEVELS; s++) {
    const softness = s / (SOFTNESS_LEVELS - 1);
    const row: HTMLCanvasElement[] = [];
    for (let c = 0; c < COLOR_BUCKETS; c++) {
      const t = c / (COLOR_BUCKETS - 1);
      row.push(makeDisc(SPRITE_SIZE, sampleRamp(palette, t), softness, 1));
    }
    discs.push(row);
  }

  const bokehBase = hexToRgb(palette.bokeh);
  const bokehBright = hexToRgb(palette.ramp[1]);
  const bokeh: HTMLCanvasElement[] = [];
  for (let i = 0; i < BOKEH_TINTS; i++) {
    const tint = i / (BOKEH_TINTS - 1);
    bokeh.push(makeDisc(256, mixRgb(bokehBase, bokehBright, tint * 0.5), 0.92, 1));
  }

  const set: SpriteSet = {
    discs,
    bokeh,
    highlight: makeDisc(256, hexToRgb(palette.highlight), 0.85, 1),
    cross: makeCross(160, hexToRgb(palette.highlight)),
  };
  spriteCache.set(palette.id, set);
  return set;
};

// Fine grain, pre-rendered as a handful of tiles and cycled by frame. The
// smooth background gradient bands in H.264 without it.
let grainTiles: HTMLCanvasElement[] | null = null;

export const getGrainTiles = (): HTMLCanvasElement[] => {
  if (grainTiles) {
    return grainTiles;
  }
  const rand = mulberry32(0x9e3779b9);
  grainTiles = [];
  for (let t = 0; t < GRAIN_TILE_COUNT; t++) {
    const canvas = createCanvas(GRAIN_TILE_SIZE);
    const ctx = canvas.getContext("2d") as CanvasRenderingContext2D;
    const image = ctx.createImageData(GRAIN_TILE_SIZE, GRAIN_TILE_SIZE);
    for (let i = 0; i < image.data.length; i += 4) {
      image.data[i] = 255;
      image.data[i + 1] = 255;
      image.data[i + 2] = 255;
      image.data[i + 3] = Math.floor(rand() * 255);
    }
    ctx.putImageData(image, 0, 0);
    grainTiles.push(canvas);
  }
  return grainTiles;
};
