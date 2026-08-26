import {useLayoutEffect, type RefObject} from 'react';
import {FRAME_HEIGHT, FRAME_WIDTH} from '../config';

/**
 * Runs `draw` synchronously after every commit, before the browser paints.
 * All motion comes from the frame value the caller passes in - there is no
 * requestAnimationFrame anywhere in this project.
 */
export const useCanvasDraw = (
  ref: RefObject<HTMLCanvasElement | null>,
  draw: (ctx: CanvasRenderingContext2D) => void,
  deps: unknown[],
): void => {
  useLayoutEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    draw(ctx);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
};

/** Divisor used for the bloom buffer. Blurring at 1/4 scale is ~16x cheaper. */
export const BLOOM_DIVISOR = 4;

export const createBuffer = (width: number, height: number): HTMLCanvasElement => {
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(width));
  canvas.height = Math.max(1, Math.round(height));
  return canvas;
};

export type BloomPass = {radius: number; strength: number};

/**
 * Adds a bloom to whatever has already been drawn on `ctx`, by blurring a
 * downscaled copy of the canvas and screening it back on top. Applied only to
 * the glow layers; the map dots never pass through this.
 */
export const applyBloom = (
  ctx: CanvasRenderingContext2D,
  buffer: HTMLCanvasElement,
  passes: BloomPass[],
): void => {
  const source = ctx.canvas;
  const bufferCtx = buffer.getContext('2d');
  if (!bufferCtx) return;

  for (const pass of passes) {
    bufferCtx.setTransform(1, 0, 0, 1, 0, 0);
    bufferCtx.clearRect(0, 0, buffer.width, buffer.height);
    bufferCtx.filter = `blur(${pass.radius / BLOOM_DIVISOR}px)`;
    bufferCtx.drawImage(source, 0, 0, buffer.width, buffer.height);
    bufferCtx.filter = 'none';

    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = pass.strength;
    ctx.drawImage(buffer, 0, 0, FRAME_WIDTH, FRAME_HEIGHT);
    ctx.restore();
  }
};
