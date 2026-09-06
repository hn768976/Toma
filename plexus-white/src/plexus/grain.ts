import {
  GRAIN_ALPHA,
  GRAIN_PIXEL_SCALE,
  GRAIN_RGB,
  GRAIN_TILE_SIZE,
  GRAIN_TILES,
} from "./constants";
import { mulberry32 } from "./random";
import { scaleOf } from "./draw";

/** A set of pre-rendered noise tiles, cycled one per frame. GRAIN_TILES divides
 *  the 540-frame loop exactly, so the grain loops with everything else. */
export const makeGrainTiles = (): HTMLCanvasElement[] => {
  const rand = mulberry32(0x5eed);
  return Array.from({ length: GRAIN_TILES }, () => {
    const c = document.createElement("canvas");
    c.width = GRAIN_TILE_SIZE;
    c.height = GRAIN_TILE_SIZE;
    const ctx = c.getContext("2d") as CanvasRenderingContext2D;
    const img = ctx.createImageData(GRAIN_TILE_SIZE, GRAIN_TILE_SIZE);
    const d = img.data;
    for (let i = 0; i < d.length; i += 4) {
      d[i] = GRAIN_RGB[0];
      d[i + 1] = GRAIN_RGB[1];
      d[i + 2] = GRAIN_RGB[2];
      d[i + 3] = Math.floor(rand() * 256);
    }
    ctx.putImageData(img, 0, 0);
    return c;
  });
};

export const drawGrain = (
  ctx: CanvasRenderingContext2D,
  tiles: HTMLCanvasElement[],
  frame: number,
  width: number,
  height: number,
) => {
  const tile = tiles[((frame % tiles.length) + tiles.length) % tiles.length];
  const pattern = ctx.createPattern(tile, "repeat");
  if (!pattern) return;

  // The grain is scaled up a little so it survives the downsample to 1080p
  // instead of averaging itself away to nothing.
  const g = GRAIN_PIXEL_SCALE * scaleOf(width);
  ctx.save();
  ctx.globalAlpha = GRAIN_ALPHA;
  ctx.scale(g, g);
  ctx.fillStyle = pattern;
  ctx.fillRect(0, 0, width / g, height / g);
  ctx.restore();
  ctx.globalAlpha = 1;
};
