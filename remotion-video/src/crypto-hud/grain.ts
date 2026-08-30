import { useMemo } from "react";
import { context2d, makeCanvas } from "./buffers";
import { DURATION, GRAIN_ALPHA } from "./layout";
import { rnd, rndInt } from "./rng";

const TILE = 512;
const TILE_COUNT = 12;

/**
 * A handful of noise tiles built once. Filling 3M pixels through `random()`
 * per tile would be needlessly slow, so each tile runs a small LCG that is
 * itself seeded from `random()` — still a pure function of the seed string.
 */
export const useGrainTiles = (seed: string) =>
  useMemo(() => {
    const tiles: HTMLCanvasElement[] = [];
    for (let t = 0; t < TILE_COUNT; t++) {
      const canvas = makeCanvas(TILE, TILE);
      const ctx = context2d(canvas);
      const image = ctx.createImageData(TILE, TILE);
      let state = Math.floor(rnd(`${seed}-grain-${t}`) * 0xfffffff) + 1;
      for (let i = 0; i < image.data.length; i += 4) {
        state = (state * 1664525 + 1013904223) >>> 0;
        image.data[i] = 255;
        image.data[i + 1] = 255;
        image.data[i + 2] = 255;
        image.data[i + 3] = state >>> 24;
      }
      ctx.putImageData(image, 0, 0);
      tiles.push(canvas);
    }
    return tiles;
  }, [seed]);

/** Fine additive grain, re-seeded every frame from `frame % 900`. */
export const drawGrain = (
  ctx: CanvasRenderingContext2D,
  tiles: HTMLCanvasElement[],
  seed: string,
  frame: number,
  width: number,
  height: number,
) => {
  const f = frame % DURATION;
  const tile = tiles[f % tiles.length];
  const pattern = ctx.createPattern(tile, "repeat");
  if (!pattern) {
    return;
  }
  const ox = rndInt(`${seed}-grain-x-${f}`, 0, TILE);
  const oy = rndInt(`${seed}-grain-y-${f}`, 0, TILE);
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  ctx.globalAlpha = GRAIN_ALPHA;
  ctx.translate(-ox, -oy);
  ctx.fillStyle = pattern;
  ctx.fillRect(0, 0, width + TILE, height + TILE);
  ctx.restore();
};
