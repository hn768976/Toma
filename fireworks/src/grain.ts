import {hexToRgb, mixRgb} from './colors';
import {rand} from './rng';
import type {Palette} from './variants';

/**
 * Fine film grain. Six noise tiles are built once and then tiled over the
 * frame; which tile is used and how it is offset is drawn from the frame
 * number, so the grain moves every frame and repeats exactly on the loop.
 */

const TILE = 128;
const TILE_COUNT = 6;

const cache = new Map<string, HTMLCanvasElement[]>();

export const getGrainTiles = (
  key: string,
  palette: Palette,
): HTMLCanvasElement[] => {
  const cached = cache.get(key);
  if (cached) {
    return cached;
  }
  const dark = hexToRgb(palette.vignette);
  const light = hexToRgb(palette.grain);
  const tiles: HTMLCanvasElement[] = [];

  for (let t = 0; t < TILE_COUNT; t++) {
    const canvas = document.createElement('canvas');
    canvas.width = TILE;
    canvas.height = TILE;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      continue;
    }
    const image = ctx.createImageData(TILE, TILE);
    for (let i = 0; i < TILE * TILE; i++) {
      // Centred on the midpoint between the two palette ends, so the tile
      // lightens and darkens the frame equally under an overlay blend.
      const v = 0.5 + (rand(key + ':grain' + t + ':' + i) - 0.5) * 0.9;
      const c = mixRgb(dark, light, v);
      image.data[i * 4] = c[0];
      image.data[i * 4 + 1] = c[1];
      image.data[i * 4 + 2] = c[2];
      image.data[i * 4 + 3] = 255;
    }
    ctx.putImageData(image, 0, 0);
    tiles.push(canvas);
  }
  cache.set(key, tiles);
  return tiles;
};

export const GRAIN_TILE_SIZE = TILE;
export const GRAIN_TILE_COUNT = TILE_COUNT;
