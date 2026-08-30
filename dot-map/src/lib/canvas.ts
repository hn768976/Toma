import type {Rgb} from './color';
import {rgba} from './color';

/**
 * Tens of thousands of individual fillRect calls per frame is the thing that
 * makes a 4K dot field slow. This batches squares into one Path2D per
 * (colour, quantised alpha) pair, so a whole field costs a few dozen fills.
 */
export class RectBatch {
  /** Number of alpha steps. Quantising is what makes the batching possible. */
  static readonly LEVELS = 20;

  private readonly paths = new Map<number, Path2D>();

  add(colorIndex: number, alpha: number, x: number, y: number, size: number) {
    const level = Math.round(alpha * RectBatch.LEVELS);
    if (level <= 0) {
      return;
    }
    const key = colorIndex * (RectBatch.LEVELS + 1) + Math.min(level, RectBatch.LEVELS);
    let path = this.paths.get(key);
    if (!path) {
      path = new Path2D();
      this.paths.set(key, path);
    }
    path.rect(x, y, size, size);
  }

  flush(ctx: CanvasRenderingContext2D, colors: readonly Rgb[]) {
    for (const [key, path] of this.paths) {
      const colorIndex = Math.floor(key / (RectBatch.LEVELS + 1));
      const level = key % (RectBatch.LEVELS + 1);
      ctx.fillStyle = rgba(colors[colorIndex], level / RectBatch.LEVELS);
      ctx.fill(path);
    }
  }
}

export const makeCanvas = (width: number, height: number): HTMLCanvasElement => {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return canvas;
};

export const context2d = (canvas: HTMLCanvasElement): CanvasRenderingContext2D => {
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Could not acquire a 2D canvas context');
  }
  return ctx;
};
