// Fine film grain.
//
// A bank of noise tiles is generated once from seeded random(); each frame
// picks one tile and a seeded offset from `frame % 600`, so the grain is
// deterministic, loops with everything else, and costs a handful of blits
// instead of eight million per-pixel operations at 4K.

import { random } from "remotion";

const TILE_COUNT = 12;
const TILE_SIZE = 256;
export const GRAIN_ALPHA = 0.04;

let bank: HTMLCanvasElement[] | null = null;

export const getGrainTiles = (): HTMLCanvasElement[] => {
  if (bank) return bank;
  const tiles: HTMLCanvasElement[] = [];
  for (let t = 0; t < TILE_COUNT; t++) {
    const c = document.createElement("canvas");
    c.width = TILE_SIZE;
    c.height = TILE_SIZE;
    const ctx = c.getContext("2d");
    if (!ctx) continue;
    const img = ctx.createImageData(TILE_SIZE, TILE_SIZE);
    const px = img.data;
    for (let i = 0; i < TILE_SIZE * TILE_SIZE; i++) {
      // Centred on mid-grey so the "overlay" blend darkens and lightens
      // symmetrically rather than only adding light.
      const value = 96 + Math.round(random(`grain-${t}-${i}`) * 128);
      px[i * 4] = value;
      px[i * 4 + 1] = value;
      px[i * 4 + 2] = value;
      px[i * 4 + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
    tiles.push(c);
  }
  bank = tiles;
  return bank;
};

export const drawGrain = (
  ctx: CanvasRenderingContext2D,
  frame: number,
  width: number,
  height: number,
  loopLength: number,
) => {
  const tiles = getGrainTiles();
  if (tiles.length === 0) return;
  const f = ((frame % loopLength) + loopLength) % loopLength;
  const tile = tiles[Math.floor(random(`grain-pick-${f}`) * tiles.length) % tiles.length];
  const ox = Math.floor(random(`grain-ox-${f}`) * TILE_SIZE);
  const oy = Math.floor(random(`grain-oy-${f}`) * TILE_SIZE);

  ctx.save();
  ctx.globalCompositeOperation = "overlay";
  ctx.globalAlpha = GRAIN_ALPHA;
  for (let x = -ox; x < width; x += TILE_SIZE) {
    for (let y = -oy; y < height; y += TILE_SIZE) {
      ctx.drawImage(tile, x, y);
    }
  }
  ctx.restore();
};
