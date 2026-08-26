import {rnd} from './rand';

export const GRAIN_TILE = 512;
export const GRAIN_TILES = 4;

/**
 * Grain tiles are built once and tiled across the frame with a seeded offset
 * per frame. Filling 8.3 million pixels of noise every frame would dominate the
 * render; four 512px tiles shuffled by frame are indistinguishable at 4% alpha.
 *
 * The per-pixel values come from a small LCG whose seed is drawn from
 * Remotion's random(), so the tiles are byte-identical on every machine while
 * staying cheap enough to build at mount time.
 */
export const buildGrainTiles = (): HTMLCanvasElement[] => {
  const tiles: HTMLCanvasElement[] = [];

  for (let t = 0; t < GRAIN_TILES; t++) {
    const canvas = document.createElement('canvas');
    canvas.width = GRAIN_TILE;
    canvas.height = GRAIN_TILE;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Could not acquire a 2D context for the grain tile');
    }

    const image = ctx.createImageData(GRAIN_TILE, GRAIN_TILE);
    const data = image.data;
    let state = Math.floor(rnd(`grain-seed-${t}`) * 0x7fffffff) + 1;

    for (let i = 0; i < data.length; i += 4) {
      state = (state * 1103515245 + 12345) & 0x7fffffff;
      const v = (state >>> 16) & 255;
      data[i] = v;
      data[i + 1] = v;
      data[i + 2] = v;
      data[i + 3] = 255;
    }

    ctx.putImageData(image, 0, 0);
    tiles.push(canvas);
  }

  return tiles;
};
