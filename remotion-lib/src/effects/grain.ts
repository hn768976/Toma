/**
 * grainPass — film grain as pre-baked noise tiles.
 *
 * WHAT: Builds N tiles of seeded monochrome noise once, then stamps one per
 * frame across the frame. Appears in 57 of the source projects.
 *
 * WHY TILES: generating noise per pixel per frame at 4K is ~8M random values
 * and an ImageData write every frame. Baking a handful of tiles up front and
 * cycling them costs one `drawImage` per tile position and is visually
 * indistinguishable, because grain is supposed to be structureless anyway.
 *
 * WHY MULTIPLE TILES: a single tile re-stamped every frame is static grain,
 * which reads as dirt on the lens rather than as film. Cycling `tileCount`
 * tiles by frame gives the grain its own temporal life. Four is enough; below
 * three the cycle becomes findable.
 *
 * WHY 128 NEUTRAL: the tiles are drawn with `overlay` composition, where a
 * mid-grey pixel leaves the underlying colour unchanged. Noise is therefore
 * generated AROUND 128, so grain adds texture in both directions without
 * shifting overall exposure. Using 'source-over' with dark noise would darken
 * the image as a side effect.
 *
 * PARAMETERS (buildGrainTiles)
 *   size       Tile edge in px. Default 256. Larger tiles show less repeat but
 *              cost more to bake.
 *   tileCount  How many distinct tiles. Default 4.
 *   seed       Integer seed. Same seed, same tiles, every render.
 *   intensity  Noise amplitude around neutral, 0..1. Default 0.5.
 *
 * PARAMETERS (grainPass)
 *   ctx, width, height  Destination and frame size.
 *   tiles      From `buildGrainTiles`.
 *   frame      Current frame; selects which tile and jitters placement.
 *   opacity    Strength of the pass. Default 0.06. Grain wants to be barely
 *              perceptible — above ~0.15 it reads as noise, not film.
 *   composite  Default 'overlay'. See above.
 *
 * GOTCHA: build the tiles ONCE (useMemo) and pass them in. Rebuilding per frame
 * defeats the entire point.
 *
 * GOTCHA: `overlay` needs a mid-tone image to work on. Over pure black the
 * grain will barely show; over a near-black gradient it will. If you need grain
 * on true black, use `composite: 'lighter'` and a low opacity instead.
 *
 * EXAMPLE
 *   const tiles = useMemo(() => buildGrainTiles({ seed: 1 }), []);
 *   grainPass({ ctx, width, height, tiles, frame, opacity: 0.06 });
 */
import type { Ctx } from '../types';
import { mulberry32 } from '../random/seededRandom';

export type BuildGrainTilesOptions = {
  size?: number;
  tileCount?: number;
  seed?: number;
  intensity?: number;
};

export const buildGrainTiles = ({
  size = 256,
  tileCount = 4,
  seed = 1,
  intensity = 0.5,
}: BuildGrainTilesOptions = {}): HTMLCanvasElement[] => {
  const tiles: HTMLCanvasElement[] = [];

  for (let t = 0; t < tileCount; t++) {
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('2d context unavailable while baking grain');

    const image = ctx.createImageData(size, size);
    const data = image.data;
    // Each tile gets its own stream, so tiles are independent rather than
    // consecutive slices of one sequence.
    const rng = mulberry32(seed + t * 7919);
    const amp = 127 * intensity;

    for (let i = 0; i < data.length; i += 4) {
      // 128 is neutral under 'overlay': it leaves the underlying pixel alone.
      const v = 128 + (rng() * 2 - 1) * amp;
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

export type GrainPassOptions = {
  ctx: Ctx;
  width: number;
  height: number;
  tiles: HTMLCanvasElement[];
  frame: number;
  opacity?: number;
  composite?: GlobalCompositeOperation;
};

export const grainPass = ({
  ctx,
  width,
  height,
  tiles,
  frame,
  opacity = 0.06,
  composite = 'overlay',
}: GrainPassOptions): void => {
  if (tiles.length === 0 || opacity <= 0) return;

  const tile = tiles[frame % tiles.length];
  const size = tile.width;

  ctx.save();
  ctx.globalCompositeOperation = composite;
  ctx.globalAlpha = opacity;

  // Offset the whole grid per frame so the tile seams do not sit in the same
  // place twice running. Derived from the frame, so it stays deterministic.
  const offsetX = -((frame * 37) % size);
  const offsetY = -((frame * 61) % size);

  for (let y = offsetY; y < height; y += size) {
    for (let x = offsetX; x < width; x += size) {
      ctx.drawImage(tile, x, y);
    }
  }

  ctx.restore();
};
