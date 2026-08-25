import {random} from 'remotion';
import {DURATION, HEIGHT, WIDTH} from './constants';

/**
 * Post passes. All of them are light-mode inversions of the usual dark-terminal
 * finish: no bloom, no additive glow, no dark vignette.
 */

const GRAIN_TILES = 12;
const GRAIN_SIZE = 512;

/** Twelve seeded noise tiles, built once and reused for the whole render. */
export const buildGrain = (): HTMLCanvasElement[] =>
  Array.from({length: GRAIN_TILES}, (_, t) => {
    const c = document.createElement('canvas');
    c.width = GRAIN_SIZE;
    c.height = GRAIN_SIZE;
    const ctx = c.getContext('2d') as CanvasRenderingContext2D;
    const img = ctx.createImageData(GRAIN_SIZE, GRAIN_SIZE);
    for (let i = 0; i < GRAIN_SIZE * GRAIN_SIZE; i++) {
      // Near-white noise: multiplied in, this darkens by at most ~10%.
      const v = 229 + Math.round(random(`grain-${t}-${i}`) * 26);
      img.data[i * 4] = v;
      img.data[i * 4 + 1] = v;
      img.data[i * 4 + 2] = v;
      img.data[i * 4 + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
    return c;
  });

/**
 * Haze: the upper-left of the frame is the furthest part of the screen from the
 * lens, so it washes almost to pure white rather than fading to black.
 */
export const drawHaze = (ctx: CanvasRenderingContext2D) => {
  const g = ctx.createLinearGradient(0, 0, WIDTH * 0.62, HEIGHT * 0.70);
  g.addColorStop(0, 'rgba(255,255,255,0.92)');
  g.addColorStop(0.20, 'rgba(255,255,255,0.42)');
  g.addColorStop(0.42, 'rgba(255,255,255,0.06)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
};

/**
 * Brightness breathe: on a white screen, lifting content toward the background
 * IS the brightness change. Period 540 divides 1620, so it closes on the loop.
 */
export const drawBreathe = (ctx: CanvasRenderingContext2D, frame: number) => {
  const a = 0.03 * (1 - Math.sin((2 * Math.PI * frame) / 540));
  ctx.fillStyle = `rgba(255,255,255,${a.toFixed(4)})`;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
};

/**
 * Bloom-OUT, not bloom. A blurred copy is composited with `lighten`, so bright
 * areas creep into their neighbours and highlights clip gently — the way an
 * overexposed macro shot of a white panel behaves. Nothing is added.
 */
export const drawBloomOut = (
  ctx: CanvasRenderingContext2D,
  source: HTMLCanvasElement,
  scratch: HTMLCanvasElement
) => {
  const sctx = scratch.getContext('2d') as CanvasRenderingContext2D;
  sctx.setTransform(1, 0, 0, 1, 0, 0);
  sctx.globalCompositeOperation = 'copy';
  sctx.filter = 'blur(5px)';
  sctx.drawImage(source, 0, 0, scratch.width, scratch.height);
  sctx.filter = 'none';
  sctx.globalCompositeOperation = 'source-over';

  ctx.save();
  ctx.globalCompositeOperation = 'lighten';
  ctx.globalAlpha = 0.2;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(scratch, 0, 0, WIDTH, HEIGHT);
  ctx.restore();
};

/** A warm, very slight vignette — this is a lit white panel, not a dark room. */
export const drawVignette = (ctx: CanvasRenderingContext2D) => {
  const r = Math.hypot(WIDTH, HEIGHT) / 2;
  const g = ctx.createRadialGradient(
    WIDTH * 0.46, HEIGHT * 0.54, r * 0.30,
    WIDTH * 0.46, HEIGHT * 0.54, r * 1.02
  );
  g.addColorStop(0, 'rgba(255,255,255,0)');
  g.addColorStop(0.66, 'rgba(250,245,239,0.22)');
  g.addColorStop(1, 'rgba(236,225,212,0.85)');
  ctx.save();
  ctx.globalCompositeOperation = 'multiply';
  ctx.globalAlpha = 0.34;
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
  ctx.restore();
};

/** Fine grain, seeded on frame % DURATION so it closes at the loop point. */
export const drawGrain = (
  ctx: CanvasRenderingContext2D,
  frame: number,
  tiles: HTMLCanvasElement[]
) => {
  const f = frame % DURATION;
  ctx.save();
  ctx.globalCompositeOperation = 'multiply';
  ctx.globalAlpha = 0.3;
  for (let pass = 0; pass < 2; pass++) {
    const tile = tiles[Math.floor(random(`grain-tile-${f}-${pass}`) * tiles.length)];
    const ox = Math.floor(random(`grain-ox-${f}-${pass}`) * GRAIN_SIZE);
    const oy = Math.floor(random(`grain-oy-${f}-${pass}`) * GRAIN_SIZE);
    const pat = ctx.createPattern(tile, 'repeat') as CanvasPattern;
    ctx.save();
    ctx.translate(-ox, -oy);
    ctx.fillStyle = pat;
    ctx.fillRect(0, 0, WIDTH + GRAIN_SIZE, HEIGHT + GRAIN_SIZE);
    ctx.restore();
    ctx.globalAlpha = 0.18;
  }
  ctx.restore();
};
