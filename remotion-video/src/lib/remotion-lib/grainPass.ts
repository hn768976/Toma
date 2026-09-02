/**
 * Fine film grain, tiled from a small set of pre-rendered noise tiles.
 *
 * Generating eight million random values per frame would dominate the render;
 * a handful of tiles built once and re-tiled with a per-frame offset is
 * visually equivalent. Tile choice and offset are pure functions of
 * frame % loopLength, so the grain repeats exactly with the loop and the
 * render stays deterministic across workers.
 */

import { createLayer } from "./canvas";
import { rand01 } from "./seededRandom";

export interface GrainTiles {
  tiles: HTMLCanvasElement[];
  size: number;
}

export const buildGrainTiles = (
  seed: string,
  count: number,
  size: number,
): GrainTiles => {
  const tiles: HTMLCanvasElement[] = [];
  for (let t = 0; t < count; t++) {
    const { canvas, ctx } = createLayer(size, size);
    const image = ctx.createImageData(size, size);
    const { data } = image;
    for (let i = 0; i < size * size; i++) {
      // Mid grey is the identity for "overlay", so deviation from 128 is the
      // grain and nothing else shifts.
      const v = 128 + (rand01(`${seed}-${t}-${i}`) * 2 - 1) * 110;
      data[i * 4] = v;
      data[i * 4 + 1] = v;
      data[i * 4 + 2] = v;
      data[i * 4 + 3] = 255;
    }
    ctx.putImageData(image, 0, 0);
    tiles.push(canvas);
  }
  return { tiles, size };
};

export const grainPass = (
  ctx: CanvasRenderingContext2D,
  grain: GrainTiles,
  frameInLoop: number,
  alpha: number,
): void => {
  const { tiles, size } = grain;
  const tile = tiles[frameInLoop % tiles.length];
  const offsetX = -Math.floor(rand01(`grain-x-${frameInLoop}`) * size);
  const offsetY = -Math.floor(rand01(`grain-y-${frameInLoop}`) * size);

  ctx.save();
  ctx.globalCompositeOperation = "overlay";
  ctx.globalAlpha = alpha;
  const pattern = ctx.createPattern(tile, "repeat");
  if (pattern) {
    ctx.translate(offsetX, offsetY);
    ctx.fillStyle = pattern;
    ctx.fillRect(0, 0, ctx.canvas.width - offsetX, ctx.canvas.height - offsetY);
  }
  ctx.restore();
};
