import { random } from "remotion";
import {
  GRAIN_ALPHA,
  GRAIN_TILE_SIZE,
  HEIGHT,
  VIGNETTE_STRENGTH,
  WIDTH,
} from "./constants";

/** Darkens the corners by roughly VIGNETTE_STRENGTH. */
export const drawVignette = (ctx: CanvasRenderingContext2D) => {
  const radius = Math.sqrt(WIDTH * WIDTH + HEIGHT * HEIGHT) / 2;
  const gradient = ctx.createRadialGradient(
    WIDTH / 2,
    HEIGHT / 2,
    radius * 0.28,
    WIDTH / 2,
    HEIGHT / 2,
    radius,
  );
  gradient.addColorStop(0, "rgba(0, 0, 0, 0)");
  gradient.addColorStop(0.6, `rgba(0, 0, 0, ${(VIGNETTE_STRENGTH * 0.4).toFixed(4)})`);
  gradient.addColorStop(1, `rgba(0, 0, 0, ${(VIGNETTE_STRENGTH * 2.05).toFixed(4)})`);

  ctx.globalCompositeOperation = "source-over";
  ctx.globalAlpha = 1;
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
};

/**
 * Fine grain, tiled from pre-built noise. Which tile and where it sits are
 * seeded from the frame within the loop, so frame 450 grains exactly like
 * frame 0.
 */
export const drawGrain = (
  ctx: CanvasRenderingContext2D,
  tiles: HTMLCanvasElement[],
  loopFrame: number,
) => {
  if (tiles.length === 0) return;
  const index = Math.floor(random(`grain-tile-${loopFrame}`) * tiles.length) % tiles.length;
  const offsetX = Math.floor(random(`grain-x-${loopFrame}`) * GRAIN_TILE_SIZE);
  const offsetY = Math.floor(random(`grain-y-${loopFrame}`) * GRAIN_TILE_SIZE);

  const pattern = ctx.createPattern(tiles[index], "repeat");
  if (!pattern) return;

  ctx.save();
  ctx.globalCompositeOperation = "overlay";
  ctx.globalAlpha = GRAIN_ALPHA;
  ctx.translate(-offsetX, -offsetY);
  ctx.fillStyle = pattern;
  ctx.fillRect(0, 0, WIDTH + GRAIN_TILE_SIZE, HEIGHT + GRAIN_TILE_SIZE);
  ctx.restore();
};
