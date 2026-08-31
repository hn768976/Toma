/**
 * Fine grain at ~2% alpha. Minimal, and the only thing on top of the dialogs —
 * no bloom, no glow, no vignette. This is flat UI.
 *
 * A single seeded noise tile is built once and blitted across the frame at a
 * per-frame seeded offset, so the grain moves without ever being random.
 */

import { random } from "remotion";
import { HEIGHT, WIDTH } from "./config";

const TILE = 128;

let tile: HTMLCanvasElement | null = null;

const getTile = (color: string) => {
  if (tile) {
    return tile;
  }
  const canvas = document.createElement("canvas");
  canvas.width = TILE;
  canvas.height = TILE;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Could not acquire a 2d context for the grain tile");
  }
  const image = ctx.createImageData(TILE, TILE);
  // Parse the grain colour once via a 1px fill rather than hand-rolling a hex
  // parser, keeping every colour literal inside VARIANTS.
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, 1, 1);
  const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
  ctx.clearRect(0, 0, 1, 1);

  for (let i = 0; i < TILE * TILE; i++) {
    const o = i * 4;
    image.data[o] = r;
    image.data[o + 1] = g;
    image.data[o + 2] = b;
    image.data[o + 3] = Math.round(random(`grain-${i}`) * 255);
  }
  ctx.putImageData(image, 0, 0);
  tile = canvas;
  return tile;
};

export const drawGrain = (
  ctx: CanvasRenderingContext2D,
  frame: number,
  color: string,
  alpha: number,
) => {
  if (alpha <= 0) {
    return;
  }
  const grain = getTile(color);
  const offsetX = -Math.floor(random(`grain-x-${frame}`) * TILE);
  const offsetY = -Math.floor(random(`grain-y-${frame}`) * TILE);
  ctx.save();
  ctx.globalAlpha = alpha;
  for (let y = offsetY; y < HEIGHT; y += TILE) {
    for (let x = offsetX; x < WIDTH; x += TILE) {
      ctx.drawImage(grain, x, y);
    }
  }
  ctx.restore();
};
