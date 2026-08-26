import {random} from 'remotion';
import {DURATION, HEIGHT, WIDTH} from './constants';
import {Theme} from './theme';

/**
 * Post passes.
 *
 * Every one of these inverts between the two looks. On white nothing is
 * emissive, so highlights clip gently toward the paper and grain has to be
 * multiplied in; on black the UI genuinely emits, so it blooms additively and
 * grain sits in the shadows.
 */

const GRAIN_TILES = 12;
const GRAIN_SIZE = 512;

/**
 * Twelve seeded noise tiles, built once and reused for the whole render.
 *
 * `multiply` needs near-white noise — near-black would crush the frame. Adding
 * with `lighter` needs the opposite. The theme picks which set to build.
 */
export const buildGrain = (t: Theme): HTMLCanvasElement[] => {
  const dark = t.grainMode === 'lighter';
  return Array.from({length: GRAIN_TILES}, (_, tile) => {
    const c = document.createElement('canvas');
    c.width = GRAIN_SIZE;
    c.height = GRAIN_SIZE;
    const ctx = c.getContext('2d') as CanvasRenderingContext2D;
    const img = ctx.createImageData(GRAIN_SIZE, GRAIN_SIZE);
    for (let i = 0; i < GRAIN_SIZE * GRAIN_SIZE; i++) {
      const n = Math.round(random(`grain-${tile}-${i}`) * 26);
      const v = dark ? n : 229 + n;
      img.data[i * 4] = v;
      img.data[i * 4 + 1] = v;
      img.data[i * 4 + 2] = v;
      img.data[i * 4 + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
    return c;
  });
};

/**
 * Haze: the upper-left of the frame is the furthest part of the screen from the
 * lens, so it dissolves into the background rather than holding detail. On
 * white that reads as a wash almost to paper; on black, as a fall to near-black.
 */
export const drawHaze = (ctx: CanvasRenderingContext2D, t: Theme) => {
  const [r, g, b] = t.bgRgb;
  const grad = ctx.createLinearGradient(0, 0, WIDTH * 0.62, HEIGHT * 0.7);
  grad.addColorStop(0, `rgba(${r},${g},${b},${t.hazeStops[0]})`);
  grad.addColorStop(0.2, `rgba(${r},${g},${b},${t.hazeStops[1]})`);
  grad.addColorStop(0.42, `rgba(${r},${g},${b},${t.hazeStops[2]})`);
  grad.addColorStop(1, `rgba(${r},${g},${b},0)`);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
};

/**
 * Brightness breathe. Lifting content toward the background IS the brightness
 * change — on white that dims the UI, on black it fades it. Period 540 divides
 * 1620, so it closes on the loop.
 */
export const drawBreathe = (ctx: CanvasRenderingContext2D, frame: number, t: Theme) => {
  const [r, g, b] = t.bgRgb;
  const a = 0.03 * (1 - Math.sin((2 * Math.PI * frame) / 540));
  ctx.fillStyle = `rgba(${r},${g},${b},${a.toFixed(4)})`;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
};

/**
 * Bloom, both directions.
 *
 * `out` — a blurred copy composited with `lighten`, so bright areas creep into
 * their neighbours and highlights clip gently, the way an overexposed macro
 * shot of a white panel behaves. Nothing is added.
 *
 * `add` — a genuine additive bloom in two octaves: a tight halo and a broad
 * one. A dark screen is emissive, and its light really does spill.
 */
export const drawBloom = (
  ctx: CanvasRenderingContext2D,
  source: HTMLCanvasElement,
  scratch: HTMLCanvasElement,
  t: Theme
) => {
  const sctx = scratch.getContext('2d') as CanvasRenderingContext2D;
  const pass = (blur: number, mode: GlobalCompositeOperation, alpha: number) => {
    sctx.setTransform(1, 0, 0, 1, 0, 0);
    sctx.globalCompositeOperation = 'copy';
    sctx.filter = `blur(${blur}px)`;
    sctx.drawImage(source, 0, 0, scratch.width, scratch.height);
    sctx.filter = 'none';
    sctx.globalCompositeOperation = 'source-over';

    ctx.save();
    ctx.globalCompositeOperation = mode;
    ctx.globalAlpha = alpha;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(scratch, 0, 0, WIDTH, HEIGHT);
    ctx.restore();
  };

  if (t.bloom === 'out') {
    pass(5, 'lighten', 0.2);
  } else {
    pass(4, 'lighter', 0.3);
    pass(14, 'lighter', 0.17);
  }
};

/** A slight vignette: warm on the lit white panel, cool and deeper on black. */
export const drawVignette = (ctx: CanvasRenderingContext2D, t: Theme) => {
  const r = Math.hypot(WIDTH, HEIGHT) / 2;
  const grad = ctx.createRadialGradient(
    WIDTH * 0.46, HEIGHT * 0.54, r * 0.3,
    WIDTH * 0.46, HEIGHT * 0.54, r * 1.02
  );
  grad.addColorStop(0, 'rgba(255,255,255,0)');
  grad.addColorStop(0.66, t.vignette.mid);
  grad.addColorStop(1, t.vignette.outer);
  ctx.save();
  ctx.globalCompositeOperation = 'multiply';
  ctx.globalAlpha = t.vignette.alpha;
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
  ctx.restore();
};

/** Fine grain, seeded on frame % DURATION so it closes at the loop point. */
export const drawGrain = (
  ctx: CanvasRenderingContext2D,
  frame: number,
  tiles: HTMLCanvasElement[],
  t: Theme
) => {
  const f = frame % DURATION;
  ctx.save();
  ctx.globalCompositeOperation = t.grainMode;
  ctx.globalAlpha = t.grainAlpha;
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
    ctx.globalAlpha = t.grainAlpha * 0.6;
  }
  ctx.restore();
};
