// Fine grain. The pure-black field bands badly around the glow once the
// footage is encoded, and a little noise dithers those steps away.
//
// A handful of tiles are generated once from the seeded PRNG and cycled;
// the tile count divides DURATION_IN_FRAMES, so the grain loops with
// everything else and costs nothing per frame.

import { GRAIN_AMOUNT, GRAIN_SEED, GRAIN_TILE } from "./constants";
import { mulberry32 } from "./random";

export const GRAIN_TILE_COUNT = 16; // 480 / 16 = 30 whole cycles per loop

export const createGrainTiles = (): string[] => {
  const rand = mulberry32(GRAIN_SEED);
  const peak = 255 * GRAIN_AMOUNT * 2;
  const tiles: string[] = [];

  for (let t = 0; t < GRAIN_TILE_COUNT; t++) {
    const canvas = document.createElement("canvas");
    canvas.width = GRAIN_TILE;
    canvas.height = GRAIN_TILE;
    const ctx = canvas.getContext("2d");
    if (!ctx) continue;
    const image = ctx.createImageData(GRAIN_TILE, GRAIN_TILE);
    const data = image.data;
    for (let p = 0; p < data.length; p += 4) {
      // Two samples averaged gives a triangular distribution, which reads
      // more like film grain than a flat one.
      const v = ((rand() + rand()) * 0.5 * peak) | 0;
      data[p] = v;
      data[p + 1] = v;
      data[p + 2] = v;
      data[p + 3] = 255;
    }
    ctx.putImageData(image, 0, 0);
    tiles.push(canvas.toDataURL("image/png"));
  }

  return tiles;
};
