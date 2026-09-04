import { makeRng } from "./rng";

const TILE = 256;
/** A small ring of tiles is cycled by frame number: deterministic per frame,
 *  but the grain still crawls the way film grain does. */
const TILE_COUNT = 8;

let cache: HTMLCanvasElement[] | null = null;

export const grainTiles = (): HTMLCanvasElement[] => {
  if (cache) return cache;
  const rng = makeRng(0x5eed17);
  const tiles: HTMLCanvasElement[] = [];
  for (let t = 0; t < TILE_COUNT; t++) {
    const cv = document.createElement("canvas");
    cv.width = TILE;
    cv.height = TILE;
    const c = cv.getContext("2d");
    if (!c) continue;
    const img = c.createImageData(TILE, TILE);
    const d = img.data;
    for (let i = 0; i < TILE * TILE; i++) {
      // Triangular noise: whiter grain, less blotchy than uniform.
      const v = Math.round((rng() + rng()) * 127.5);
      d[i * 4] = 255;
      d[i * 4 + 1] = 255;
      d[i * 4 + 2] = 255;
      d[i * 4 + 3] = v;
    }
    c.putImageData(img, 0, 0);
    tiles.push(cv);
  }
  cache = tiles;
  return tiles;
};

export const tileCount = TILE_COUNT;
