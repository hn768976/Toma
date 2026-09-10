// Pre-rendered grain tiles.
//
// The smooth glow gradient will band in H.264 without a dither, but generating
// 8.3M noise pixels per frame in JS is not affordable. Instead a small set of
// tiles is built once and cycled by frame index; the cycle length divides the
// loop, so the grain loops with everything else.
//
// Tiles are built at half the composition scale and drawn at 2x, so that after
// the --scale=0.5 downsample to 1080p the grain is 1:1 with output pixels. A
// grain finer than the output raster just averages itself away and stops
// dithering anything.

import { GRAIN_MAX, GRAIN_TILE_COUNT, GRAIN_TILE_SIZE } from "./constants";
import { hash01 } from "./noise";

export const GRAIN_DRAW_SCALE = 2;

export const buildGrainTiles = (): HTMLCanvasElement[] | null => {
  if (typeof document === "undefined") return null;

  const tiles: HTMLCanvasElement[] = [];
  for (let t = 0; t < GRAIN_TILE_COUNT; t++) {
    const canvas = document.createElement("canvas");
    canvas.width = GRAIN_TILE_SIZE;
    canvas.height = GRAIN_TILE_SIZE;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;

    const image = ctx.createImageData(GRAIN_TILE_SIZE, GRAIN_TILE_SIZE);
    const data = image.data;
    for (let y = 0; y < GRAIN_TILE_SIZE; y++) {
      for (let x = 0; x < GRAIN_TILE_SIZE; x++) {
        const v = Math.round(hash01(x, y, 900 + t) * GRAIN_MAX);
        const i = (y * GRAIN_TILE_SIZE + x) * 4;
        data[i] = v;
        data[i + 1] = v;
        data[i + 2] = v;
        data[i + 3] = 255;
      }
    }
    ctx.putImageData(image, 0, 0);
    tiles.push(canvas);
  }
  return tiles;
};
