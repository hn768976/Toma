import { GRAIN_CYCLE, GRAIN_TILE } from "./constants";
import { mulberry32 } from "./random";

/**
 * Pre-generates a small bank of monochrome noise tiles.
 *
 * The grain is not decoration. This clip is almost entirely large, very smooth
 * gradients, and 8-bit gradients that wide will band visibly the moment H.264
 * gets hold of them — it is by far the most likely way the encode goes wrong.
 * A per-frame dither of a couple of code values breaks the contours up before
 * the encoder can quantise them into steps.
 *
 * Tiles are signed: half the pixels lift, half darken, so the grain adds no
 * net exposure. There are GRAIN_CYCLE of them and GRAIN_CYCLE divides the clip
 * length, so the grain loops with everything else.
 */
export const buildGrainTiles = (
  create: (w: number, h: number) => HTMLCanvasElement | null,
): HTMLCanvasElement[] => {
  const tiles: HTMLCanvasElement[] = [];
  for (let t = 0; t < GRAIN_CYCLE; t++) {
    const canvas = create(GRAIN_TILE, GRAIN_TILE);
    if (!canvas) return tiles;
    const ctx = canvas.getContext("2d");
    if (!ctx) return tiles;
    const image = ctx.createImageData(GRAIN_TILE, GRAIN_TILE);
    const rand = mulberry32(7919 + t * 104729);
    for (let i = 0; i < image.data.length; i += 4) {
      const n = rand() * 2 - 1;
      const lift = n > 0 ? 255 : 0;
      image.data[i] = lift;
      image.data[i + 1] = lift;
      image.data[i + 2] = lift;
      image.data[i + 3] = Math.round(Math.abs(n) * 255);
    }
    ctx.putImageData(image, 0, 0);
    tiles.push(canvas);
  }
  return tiles;
};

/** Fills `ctx` with one tile of grain, offset so the tiling never sits still. */
export const drawGrain = (
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  frame: number,
  tiles: HTMLCanvasElement[],
  opacity: number,
) => {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, width, height);
  if (tiles.length === 0 || opacity <= 0) return;
  const index = frame % tiles.length;
  const pattern = ctx.createPattern(tiles[index], "repeat");
  if (!pattern) return;
  // Shift by a different amount each frame so the 256px tile boundary never
  // lands in the same place twice within a cycle.
  const ox = (index * 97) % GRAIN_TILE;
  const oy = (index * 61) % GRAIN_TILE;
  ctx.globalAlpha = opacity;
  ctx.translate(-ox, -oy);
  ctx.fillStyle = pattern;
  ctx.fillRect(0, 0, width + GRAIN_TILE, height + GRAIN_TILE);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 1;
};
