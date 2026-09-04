// Film grain, doubling as a dither. Large smooth sky gradients band badly in
// H.264 and a couple of percent of noise is what stops it.
//
// Tiles are pre-generated and cycled by frame index (GRAIN_TILE_COUNT divides
// the loop length) rather than scrolled, so the grain loops perfectly.
import { mulberry32 } from "../particle-ring/random";
import {
  GRAIN_AMPLITUDE,
  GRAIN_TILE_COUNT,
  GRAIN_TILE_SIZE,
} from "./constants";

let tiles: HTMLCanvasElement[] | null = null;

export const grainTiles = (seed: number): HTMLCanvasElement[] => {
  if (tiles) return tiles;
  const rand = mulberry32(seed + 4409);
  const built: HTMLCanvasElement[] = [];

  for (let t = 0; t < GRAIN_TILE_COUNT; t++) {
    const canvas = document.createElement("canvas");
    canvas.width = GRAIN_TILE_SIZE;
    canvas.height = GRAIN_TILE_SIZE;
    const ctx = canvas.getContext("2d");
    if (!ctx) break;
    const image = ctx.createImageData(GRAIN_TILE_SIZE, GRAIN_TILE_SIZE);
    const data = image.data;
    for (let i = 0; i < data.length; i += 4) {
      // Signed noise: white above the midpoint, black below, so the grain both
      // lifts and deepens rather than only brightening.
      const v = rand() * 2 - 1;
      const value = v > 0 ? 255 : 0;
      data[i] = value;
      data[i + 1] = value;
      data[i + 2] = value;
      data[i + 3] = Math.round(Math.abs(v) * GRAIN_AMPLITUDE * 255);
    }
    ctx.putImageData(image, 0, 0);
    built.push(canvas);
  }

  tiles = built;
  return tiles;
};

export const drawGrain = (
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  frame: number,
  seed: number,
) => {
  const built = grainTiles(seed);
  if (built.length === 0) return;
  const tile = built[frame % built.length];
  const pattern = ctx.createPattern(tile, "repeat");
  if (!pattern) return;
  ctx.save();
  ctx.fillStyle = pattern;
  ctx.fillRect(0, 0, width, height);
  ctx.restore();
};
