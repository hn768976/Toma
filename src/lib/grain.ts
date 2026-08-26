import {DURATION, RGB} from './theme';
import {rnd} from './rand';

/**
 * Very fine grain. Four seeded noise tiles are built once; the frame picks one
 * with `frame % 4` and offsets it by a seed derived from `frame % 840`, so the
 * grain closes the loop (840 % 4 === 0).
 */
export const GRAIN_TILES = 4;
export const GRAIN_SIZE = 256;

export type GrainTiles = HTMLCanvasElement[];

export const buildGrain = (tint: RGB): GrainTiles => {
  const tiles: HTMLCanvasElement[] = [];
  for (let t = 0; t < GRAIN_TILES; t++) {
    const c = document.createElement('canvas');
    c.width = GRAIN_SIZE;
    c.height = GRAIN_SIZE;
    const ctx = c.getContext('2d');
    if (!ctx) {
      tiles.push(c);
      continue;
    }
    const img = ctx.createImageData(GRAIN_SIZE, GRAIN_SIZE);
    const d = img.data;
    for (let i = 0, px = 0; i < d.length; i += 4, px++) {
      const n = rnd(`grain-${t}-${px}`);
      const g = Math.round(n * 255);
      // Tinted to the variant's hue so the grain never introduces another one.
      d[i] = Math.round(g * tint[0]);
      d[i + 1] = Math.round(g * tint[1]);
      d[i + 2] = Math.round(g * tint[2]);
      d[i + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
    tiles.push(c);
  }
  return tiles;
};

export const grainOffsetAt = (frame: number): {x: number; y: number; tile: number} => {
  const f = ((frame % DURATION) + DURATION) % DURATION;
  return {
    x: Math.floor(rnd(`gx-${f}`) * GRAIN_SIZE),
    y: Math.floor(rnd(`gy-${f}`) * GRAIN_SIZE),
    tile: f % GRAIN_TILES,
  };
};
