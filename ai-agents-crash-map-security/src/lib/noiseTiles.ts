import { mulberry32 } from "./random";

// Fixed noise tiles for the HTML/Canvas look, indexed by frame. Positive-only
// values (blended with plus-lighter); the background is pre-darkened by the mean.
export const TILE = 256;
export const TILE_COUNT = 8;
export const GRAIN = 0.015; // peak grain amplitude
export const DITHER = 2 / 255; // ±1/255 TPDF span
export const NOISE_MEAN_LEVELS = ((GRAIN + DITHER) * 255) / 2;

let tiles: string[] | null = null;
export const getNoiseTiles = (): string[] => {
  if (tiles) return tiles;
  tiles = [];
  for (let t = 0; t < TILE_COUNT; t++) {
    const r = mulberry32(1000 + t * 7919);
    const c = document.createElement("canvas");
    c.width = TILE;
    c.height = TILE;
    const ctx = c.getContext("2d")!;
    const img = ctx.createImageData(TILE, TILE);
    for (let i = 0; i < TILE * TILE; i++) {
      const grain = ((r() + r()) / 2) * GRAIN * 255;
      const dither = ((r() + r()) / 2) * DITHER * 255;
      const v = grain + dither;
      // keep sub-level precision by spreading across channels slightly
      const base = Math.floor(v);
      const frac = v - base;
      img.data[i * 4] = base + (r() < frac ? 1 : 0);
      img.data[i * 4 + 1] = base + (r() < frac ? 1 : 0);
      img.data[i * 4 + 2] = base + (r() < frac ? 1 : 0);
      img.data[i * 4 + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
    tiles.push(c.toDataURL("image/png"));
  }
  return tiles;
};
