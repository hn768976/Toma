/**
 * The finish: a vignette and fine grain.
 *
 * The grain tile is built once from Remotion's random() — one string-seeded
 * call per pixel, which is far too slow to redo every frame — and is then
 * placed each frame at an offset seeded on `frame % 300`, so the grain moves,
 * repeats exactly across the loop, and never touches Math.random().
 */

import React, { useCallback } from "react";
import { random } from "remotion";
import { CanvasLayer } from "../CanvasLayer";
import { shadow } from "../colour";
import { HEIGHT, WIDTH, type Scene } from "../geometry";
import { scratch } from "../scratch";

const TILE = 256;
/** Grain is drawn at 2x so it reads as grain and not as 4K pixel noise. */
const TILE_SCALE = 2;
const GRAIN_ALPHA = 0.04;
const VIGNETTE = 0.22;

let grainTile: HTMLCanvasElement | null = null;

const buildGrainTile = () => {
  if (grainTile) {
    return grainTile;
  }
  const canvas = document.createElement("canvas");
  canvas.width = TILE;
  canvas.height = TILE;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    return canvas;
  }
  const image = ctx.createImageData(TILE, TILE);
  for (let i = 0; i < TILE * TILE; i++) {
    const v = Math.round(random(`grain-${i}`) * 255);
    image.data[i * 4] = v;
    image.data[i * 4 + 1] = v;
    image.data[i * 4 + 2] = v;
    image.data[i * 4 + 3] = 255;
  }
  ctx.putImageData(image, 0, 0);
  grainTile = canvas;
  return canvas;
};

export const FilmFinish: React.FC<{ scene: Scene; z: number }> = ({
  scene,
  z,
}) => {
  const drawVignette = useCallback((ctx: CanvasRenderingContext2D) => {
    const grad = ctx.createRadialGradient(
      WIDTH / 2,
      HEIGHT / 2,
      Math.min(WIDTH, HEIGHT) * 0.28,
      WIDTH / 2,
      HEIGHT / 2,
      Math.hypot(WIDTH, HEIGHT) * 0.56,
    );
    grad.addColorStop(0, shadow(0));
    grad.addColorStop(0.6, shadow(VIGNETTE * 0.45));
    grad.addColorStop(1, shadow(VIGNETTE));
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
  }, []);

  const drawGrain = useCallback(
    (ctx: CanvasRenderingContext2D) => {
      const tile = buildGrainTile();
      const placed = scratch("grain", TILE * TILE_SCALE, TILE * TILE_SCALE);
      const pctx = placed.getContext("2d");
      if (!pctx) {
        return;
      }
      pctx.imageSmoothingEnabled = false;
      pctx.drawImage(tile, 0, 0, TILE * TILE_SCALE, TILE * TILE_SCALE);

      const pattern = ctx.createPattern(placed, "repeat");
      if (!pattern) {
        return;
      }
      // Seeded on frame % 300: the grain moves every frame and repeats
      // exactly across the loop.
      const ox = Math.round(random(`grain-x-${scene.f}`) * TILE * TILE_SCALE);
      const oy = Math.round(random(`grain-y-${scene.f}`) * TILE * TILE_SCALE);
      ctx.globalAlpha = GRAIN_ALPHA;
      ctx.translate(-ox, -oy);
      ctx.fillStyle = pattern;
      ctx.fillRect(0, 0, WIDTH + TILE * TILE_SCALE, HEIGHT + TILE * TILE_SCALE);
    },
    [scene],
  );

  return (
    <>
      <CanvasLayer z={z} draw={drawVignette} />
      <CanvasLayer z={z + 1} draw={drawGrain} blend="overlay" />
    </>
  );
};
