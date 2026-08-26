// Fine film grain.
//
// Per-pixel noise across a 4K frame is far too much work to redo every
// frame, so a handful of seeded tiles are baked once and one is chosen per
// frame from frame % 450. The tiles are mid-grey with a small excursion
// either side, which is the no-op point for the "overlay" blend the grain
// layer uses — so the grain lifts and drops the image symmetrically instead
// of only ever brightening it.

import { random } from "remotion";
import { GRAIN_INTENSITY, GRAIN_TILE_COUNT, GRAIN_TILE_SIZE } from "./config";
import { rgbChannels } from "./color";

// A tile is a quarter of a million pixels and there are several of them, so
// each pixel gets its value from a cheap PRNG rather than its own random()
// call. The PRNG's seed still comes from a stable string seed through
// Remotion's random(), so the tiles are identical on every machine and in
// every render worker.
const seededNoise = (seed: number) => {
  let state = seed | 0;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

export const buildGrainTiles = (neutralColor: string): HTMLCanvasElement[] | null => {
  if (typeof document === "undefined") return null;

  const neutral = rgbChannels(neutralColor);
  const tiles: HTMLCanvasElement[] = [];

  for (let tile = 0; tile < GRAIN_TILE_COUNT; tile++) {
    const canvas = document.createElement("canvas");
    canvas.width = GRAIN_TILE_SIZE;
    canvas.height = GRAIN_TILE_SIZE;
    const ctx = canvas.getContext("2d");
    if (!ctx) continue;

    const image = ctx.createImageData(GRAIN_TILE_SIZE, GRAIN_TILE_SIZE);
    const data = image.data;
    const pixels = GRAIN_TILE_SIZE * GRAIN_TILE_SIZE;
    const next = seededNoise(Math.floor(random("grain-tile-" + tile) * 0xffffffff));
    for (let i = 0; i < pixels; i++) {
      const noise = (next() - 0.5) * 2 * GRAIN_INTENSITY;
      const offset = i * 4;
      data[offset] = neutral.r + noise;
      data[offset + 1] = neutral.g + noise;
      data[offset + 2] = neutral.b + noise;
      data[offset + 3] = 255;
    }
    ctx.putImageData(image, 0, 0);
    tiles.push(canvas);
  }

  return tiles;
};
