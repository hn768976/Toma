import { random } from "remotion";
import { GRAIN } from "./config";

/**
 * Fine grain, tiled so it stays fine at 4K rather than being a stretched blur.
 *
 * A handful of seeded tiles are generated once and cycled by frame number, so
 * the grain crawls without a per-frame 8-megapixel noise pass. Deterministic:
 * tile N is always the same noise.
 */

let tiles: HTMLCanvasElement[] | null = null;

const buildTiles = (): HTMLCanvasElement[] => {
  const size = GRAIN.tileSize;
  const built: HTMLCanvasElement[] = [];

  for (let t = 0; t < GRAIN.tileCount; t++) {
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d") as CanvasRenderingContext2D;
    const image = ctx.createImageData(size, size);
    const data = image.data;

    // Numeric seeds here rather than string seeds: this is 400k draws of pure
    // luminance noise, and it still goes through Remotion's random().
    const base = t * size * size;
    for (let i = 0; i < size * size; i++) {
      const v = Math.round(random(base + i) * 255);
      const o = i * 4;
      data[o] = v;
      data[o + 1] = v;
      data[o + 2] = v;
      data[o + 3] = 255;
    }

    ctx.putImageData(image, 0, 0);
    built.push(canvas);
  }

  return built;
};

export const drawGrain = (
  ctx: CanvasRenderingContext2D,
  frame: number,
  width: number,
  height: number,
  alpha: number,
): void => {
  if (alpha <= 0.0005) {
    return;
  }

  if (!tiles) {
    tiles = buildTiles();
  }

  const tile = tiles[frame % tiles.length];
  const size = GRAIN.tileSize;

  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  ctx.globalAlpha = alpha;
  // Offset per frame so the tiling seam never sits still.
  const offsetX = -(frame * 37) % size;
  const offsetY = -(frame * 53) % size;

  for (let y = offsetY - size; y < height; y += size) {
    for (let x = offsetX - size; x < width; x += size) {
      ctx.drawImage(tile, x, y);
    }
  }

  ctx.restore();
};
