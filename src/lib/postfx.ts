/**
 * Finishing: bloom (dark grounds), highlight lift (light ground), glitch
 * slicing, vignette and grain. All of it is canvas work — no CSS filters and
 * no animation outside the frame number.
 */

import type {GlitchConfig, GlowPass, PostConfig} from '../variants';
import {clearCanvas, context2d, makeCanvas, rgba, rnd, rndInt} from './util';

/**
 * Composite `src` onto `dst`, then add blurred copies of it additively.
 * The blur is done at a quarter resolution, which is both far cheaper at 4K
 * and gives a wider, softer falloff than blurring the full-size buffer.
 *
 * Wide, strong passes read as bloom on a dark ground. A single tight, weak
 * pass reads instead as a gentle overexposure lift — which is what the light
 * "chat" ground wants, since additive glow on near-white is always wrong.
 */
export const compositeWithGlow = (
  dst: CanvasRenderingContext2D,
  src: HTMLCanvasElement,
  passes: GlowPass[],
  scratch: {small: HTMLCanvasElement}
): void => {
  dst.drawImage(src, 0, 0);
  if (passes.length === 0) return;

  const small = scratch.small;
  const sctx = context2d(small);
  const k = small.width / src.width;

  for (const pass of passes) {
    clearCanvas(sctx);
    sctx.filter = `blur(${Math.max(1, pass.blur * k)}px)`;
    sctx.drawImage(src, 0, 0, small.width, small.height);
    sctx.filter = 'none';

    dst.save();
    dst.globalCompositeOperation = 'lighter';
    dst.globalAlpha = pass.alpha;
    dst.drawImage(small, 0, 0, dst.canvas.width, dst.canvas.height);
    dst.restore();
  }
};

/* ------------------------------------------------------------------ glitch */

/**
 * Shift a handful of thin horizontal slices of the finished frame sideways.
 * Slice count, height, offset and direction all come from the event index, so
 * a given event looks the same every time it is rendered.
 */
export const applyGlitchSlices = (
  dst: CanvasRenderingContext2D,
  cfg: GlitchConfig,
  eventIndex: number,
  scratch: {full: HTMLCanvasElement}
): void => {
  const {width, height} = dst.canvas;
  const copy = scratch.full;
  const cctx = context2d(copy);
  clearCanvas(cctx);
  cctx.drawImage(dst.canvas, 0, 0);

  const slices = rndInt(`${cfg.seed}-slices-${eventIndex}`, cfg.minSlices, cfg.maxSlices);

  for (let s = 0; s < slices; s++) {
    const y = rnd(`${cfg.seed}-y-${eventIndex}-${s}`, 0, height);
    const h = rnd(`${cfg.seed}-h-${eventIndex}-${s}`, height * 0.012, height * 0.055);
    const dir = rnd(`${cfg.seed}-dir-${eventIndex}-${s}`) < 0.5 ? -1 : 1;
    const shift =
      dir * rnd(`${cfg.seed}-shift-${eventIndex}-${s}`, cfg.minShift, cfg.maxShift);

    dst.clearRect(0, y, width, h);
    dst.drawImage(copy, 0, y, width, h, shift, y, width, h);
    // Fill the gap the shift opens up with the untouched frame beneath.
    const gapX = dir > 0 ? 0 : width + shift;
    dst.drawImage(copy, gapX, y, Math.abs(shift), h, gapX, y, Math.abs(shift), h);
  }
};

/* ------------------------------------------------------ vignette and grain */

export const applyVignette = (
  ctx: CanvasRenderingContext2D,
  strength: number,
  invert: boolean
): void => {
  if (strength <= 0) return;
  const {width, height} = ctx.canvas;
  const g = ctx.createRadialGradient(
    width / 2,
    height / 2,
    Math.min(width, height) * 0.24,
    width / 2,
    height / 2,
    Math.hypot(width, height) * 0.6
  );
  const tone = invert ? '255,255,255' : '0,0,0';
  g.addColorStop(0, `rgba(${tone},0)`);
  g.addColorStop(0.62, `rgba(${tone},${strength * 0.35})`);
  g.addColorStop(1, `rgba(${tone},${strength})`);
  ctx.save();
  ctx.globalCompositeOperation = invert ? 'lighter' : 'source-over';
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, width, height);
  ctx.restore();
};

const GRAIN_SIZE = 512;
let grainTile: HTMLCanvasElement | null = null;

/** One seeded noise tile, built once and re-offset per frame. */
const getGrainTile = (): HTMLCanvasElement => {
  if (grainTile) return grainTile;
  const c = makeCanvas(GRAIN_SIZE, GRAIN_SIZE);
  const ctx = context2d(c);
  const img = ctx.createImageData(GRAIN_SIZE, GRAIN_SIZE);
  for (let i = 0; i < GRAIN_SIZE * GRAIN_SIZE; i++) {
    const v = Math.round(rnd(`grain-${i}`) * 255);
    img.data[i * 4] = v;
    img.data[i * 4 + 1] = v;
    img.data[i * 4 + 2] = v;
    img.data[i * 4 + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  grainTile = c;
  return c;
};

export const applyGrain = (
  ctx: CanvasRenderingContext2D,
  alpha: number,
  frame: number
): void => {
  if (alpha <= 0) return;
  const tile = getGrainTile();
  const pattern = ctx.createPattern(tile, 'repeat');
  if (!pattern) return;
  const ox = rnd(`grain-ox-${frame}`, 0, GRAIN_SIZE);
  const oy = rnd(`grain-oy-${frame}`, 0, GRAIN_SIZE);
  ctx.save();
  ctx.globalCompositeOperation = 'overlay';
  ctx.globalAlpha = alpha;
  ctx.translate(-ox, -oy);
  ctx.fillStyle = pattern;
  ctx.fillRect(0, 0, ctx.canvas.width + GRAIN_SIZE, ctx.canvas.height + GRAIN_SIZE);
  ctx.restore();
};

/* ----------------------------------------------------------------- ground */

export const paintGround = (
  ctx: CanvasRenderingContext2D,
  post: PostConfig,
  bgDeep: string,
  bgMid: string,
  cx: number,
  cy: number,
  radius: number
): void => {
  const {width, height} = ctx.canvas;
  ctx.fillStyle = bgDeep;
  ctx.fillRect(0, 0, width, height);

  const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
  g.addColorStop(0, rgba(bgMid, post.vignetteInvert ? 0.95 : 0.85));
  g.addColorStop(0.45, rgba(bgMid, post.vignetteInvert ? 0.55 : 0.42));
  g.addColorStop(1, rgba(bgMid, 0));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, width, height);
};
