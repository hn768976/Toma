/**
 * Fine grain, drawn last so it also acts as a dither over the dark falloff —
 * the deep navy-to-black vignette is exactly where 8-bit H.264 bands.
 *
 * A fixed set of noise tiles is cycled by frame number; GRAIN_TILES divides
 * DURATION_IN_FRAMES, so the grain loops with everything else.
 */

import { GRAIN_TILES, GRAIN_TILE_SIZE } from "./constants";
import { mulberry32 } from "./random";

let tiles: HTMLCanvasElement[] | null = null;

const buildTiles = () => {
  const rnd = mulberry32(0xa17e5e);
  const out: HTMLCanvasElement[] = [];
  for (let t = 0; t < GRAIN_TILES; t++) {
    const c = document.createElement("canvas");
    c.width = GRAIN_TILE_SIZE;
    c.height = GRAIN_TILE_SIZE;
    const ctx = c.getContext("2d") as CanvasRenderingContext2D;
    const img = ctx.createImageData(GRAIN_TILE_SIZE, GRAIN_TILE_SIZE);
    const d = img.data;
    for (let i = 0; i < d.length; i += 4) {
      const v = 40 + rnd() * 215;
      d[i] = v;
      d[i + 1] = v;
      d[i + 2] = v;
      d[i + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
    out.push(c);
  }
  return out;
};

export const getGrainTile = (frame: number): HTMLCanvasElement => {
  if (!tiles) {
    tiles = buildTiles();
  }
  return tiles[((frame % GRAIN_TILES) + GRAIN_TILES) % GRAIN_TILES];
};
