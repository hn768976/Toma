import {random} from 'remotion';
import {CONFIG} from '../config';
import {context2d, createBuffer} from '../lib/canvas';
import {ANCHOR_X, ANCHOR_Y} from '../lib/plane';
import {Theme, withAlpha} from '../theme';

/** Background, bloom, vignette and grain — everything that finishes the frame. */

export const paintBackground = (ctx: CanvasRenderingContext2D, theme: Theme): void => {
  const gradient = ctx.createRadialGradient(
    ANCHOR_X,
    ANCHOR_Y,
    0,
    ANCHOR_X,
    ANCHOR_Y,
    Math.hypot(CONFIG.width, CONFIG.height) * 0.62,
  );
  gradient.addColorStop(0, theme.backgroundMid);
  gradient.addColorStop(0.45, theme.backgroundMid);
  gradient.addColorStop(1, theme.backgroundDeep);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, CONFIG.width, CONFIG.height);
};

export interface BloomBuffers {
  down: HTMLCanvasElement;
  crushed: HTMLCanvasElement;
}

const BLOOM_DIVISOR = 6;

export const createBloomBuffers = (): BloomBuffers => ({
  down: createBuffer(CONFIG.width / BLOOM_DIVISOR, CONFIG.height / BLOOM_DIVISOR),
  crushed: createBuffer(CONFIG.width / BLOOM_DIVISOR, CONFIG.height / BLOOM_DIVISOR),
});

/**
 * Generous bloom, centred on the badge.
 *
 * The frame is downsampled, its darks crushed by multiplying it into itself, then
 * masked to a halo around the badge and added back blurred. Doing this at full 4K
 * resolution would cost more than the rest of the frame put together.
 */
export const paintBloom = (
  ctx: CanvasRenderingContext2D,
  main: HTMLCanvasElement,
  buffers: BloomBuffers,
  theme: Theme,
): void => {
  const w = buffers.down.width;
  const h = buffers.down.height;

  const down = context2d(buffers.down);
  down.setTransform(1, 0, 0, 1, 0, 0);
  down.globalCompositeOperation = 'source-over';
  down.globalAlpha = 1;
  down.clearRect(0, 0, w, h);
  down.drawImage(main, 0, 0, w, h);

  const crushed = context2d(buffers.crushed);
  crushed.setTransform(1, 0, 0, 1, 0, 0);
  crushed.globalCompositeOperation = 'source-over';
  crushed.globalAlpha = 1;
  crushed.clearRect(0, 0, w, h);
  crushed.drawImage(buffers.down, 0, 0);
  // Two multiplies -> the frame cubed. Only the brightest surfaces survive.
  crushed.globalCompositeOperation = 'multiply';
  crushed.drawImage(buffers.down, 0, 0);
  crushed.drawImage(buffers.down, 0, 0);

  // Weight the bloom toward the badge so its glow is what washes the cards.
  const mask = crushed.createRadialGradient(
    (ANCHOR_X / CONFIG.width) * w,
    (ANCHOR_Y / CONFIG.height) * h,
    0,
    (ANCHOR_X / CONFIG.width) * w,
    (ANCHOR_Y / CONFIG.height) * h,
    Math.hypot(w, h) * 0.55,
  );
  mask.addColorStop(0, withAlpha(theme.badgeWhite, 1));
  mask.addColorStop(0.45, withAlpha(theme.badgeWhite, 0.62));
  mask.addColorStop(1, withAlpha(theme.badgeWhite, 0.12));
  crushed.globalCompositeOperation = 'destination-in';
  crushed.fillStyle = mask;
  crushed.fillRect(0, 0, w, h);
  crushed.globalCompositeOperation = 'source-over';

  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = CONFIG.finish.bloomStrength;
  ctx.filter = `blur(${CONFIG.dof.maxBlur * 1.5}px)`;
  ctx.drawImage(buffers.crushed, 0, 0, CONFIG.width, CONFIG.height);
  ctx.filter = 'none';
  ctx.restore();
};

export const paintVignette = (ctx: CanvasRenderingContext2D, theme: Theme): void => {
  const gradient = ctx.createRadialGradient(
    ANCHOR_X,
    ANCHOR_Y,
    Math.min(CONFIG.width, CONFIG.height) * 0.22,
    ANCHOR_X,
    ANCHOR_Y,
    Math.hypot(CONFIG.width, CONFIG.height) * 0.56,
  );
  gradient.addColorStop(0, withAlpha(theme.backgroundDeep, 0));
  gradient.addColorStop(1, withAlpha(theme.backgroundDeep, CONFIG.finish.vignette));

  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, CONFIG.width, CONFIG.height);
  ctx.restore();
};

/**
 * Grain tiles.
 *
 * The tile *seeds* come from Remotion's random() so the noise is identical on
 * every machine and every render worker; expanding each seed with a small
 * integer PRNG avoids half a million seeded-hash calls per tile.
 */
const mulberry32 = (seed: number) => {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

export const createGrainTiles = (): HTMLCanvasElement[] =>
  Array.from({length: CONFIG.finish.grainTileCount}, (_, i) => {
    const size = CONFIG.finish.grainTileSize;
    const canvas = createBuffer(size, size);
    const ctx = context2d(canvas);
    const image = ctx.createImageData(size, size);
    const rand = mulberry32(Math.floor(random(`grain-tile-${i}`) * 0xffffffff));
    for (let p = 0; p < image.data.length; p += 4) {
      // Mid-grey noise, composited in 'overlay': light pixels lift, dark sink.
      const v = 96 + Math.floor(rand() * 64);
      image.data[p] = v;
      image.data[p + 1] = v;
      image.data[p + 2] = v;
      image.data[p + 3] = 255;
    }
    ctx.putImageData(image, 0, 0);
    return canvas;
  });

export const paintGrain = (
  ctx: CanvasRenderingContext2D,
  tiles: HTMLCanvasElement[],
  frame: number,
): void => {
  if (tiles.length === 0) return;
  const tile = tiles[frame % tiles.length];
  const pattern = ctx.createPattern(tile, 'repeat');
  if (!pattern) return;

  const size = CONFIG.finish.grainTileSize;
  const offsetX = Math.floor(random(`grain-x-${frame}`) * size);
  const offsetY = Math.floor(random(`grain-y-${frame}`) * size);

  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalCompositeOperation = 'overlay';
  ctx.globalAlpha = CONFIG.finish.grainAlpha;
  ctx.translate(-offsetX, -offsetY);
  ctx.fillStyle = pattern;
  ctx.fillRect(0, 0, CONFIG.width + size, CONFIG.height + size);
  ctx.restore();
};
