import {CHART} from './config';
import type {Painter} from './paint';

/**
 * Paint a straight line as short segments, each bucketed by its own focus.
 *
 * A grid rule crosses the whole frame and therefore crosses the focal band;
 * drawing it as one stroke would put the entire rule in a single blur bucket.
 */
export const segmentedLine = (
  painter: Painter,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  segLen: number,
  style: (ctx: CanvasRenderingContext2D, alpha: number) => void,
  glow = 0
) => {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const len = Math.hypot(dx, dy);
  const n = Math.max(1, Math.ceil(len / segLen));
  for (let s = 0; s < n; s++) {
    const t0 = s / n;
    const t1 = (s + 1) / n;
    const ax = x0 + dx * t0;
    const ay = y0 + dy * t0;
    const bx = x0 + dx * t1;
    const by = y0 + dy * t1;
    const focus = painter.focus((ax + bx) / 2, (ay + by) / 2);
    painter.paint(
      focus,
      (ctx, alpha) => {
        ctx.beginPath();
        ctx.moveTo(ax, ay);
        // overlap by a hair so segment joins never show as gaps
        ctx.lineTo(bx + Math.sign(dx) * 0.5, by + Math.sign(dy) * 0.5);
        style(ctx, alpha);
        ctx.stroke();
      },
      glow
    );
  }
};

/** Axis-aligned rect, bucketed by the focus at its centre. */
export const focusRect = (
  painter: Painter,
  x: number,
  y: number,
  w: number,
  h: number,
  style: (ctx: CanvasRenderingContext2D, alpha: number) => void,
  glow = 0
) => {
  const focus = painter.focus(x + w / 2, y + h / 2);
  painter.paint(
    focus,
    (ctx, alpha, bufferIndex) => {
      style(ctx, alpha);
      if (glow > 0 && bufferIndex > 0) {
        // grow the footprint a little before it is blurred, so a bright cell
        // blooms into a soft disc instead of a smeared rectangle
        const g = Math.min(w, h) * 0.6;
        const gx = g;
        const gy = g;
        ctx.fillRect(x - gx, y - gy, w + gx * 2, h + gy * 2);
      } else {
        ctx.fillRect(x, y, w, h);
      }
    },
    glow
  );
};

/** Chart-space x of candle `index` within a tile copy. */
export const candleX = (index: number) => index * CHART.pitch;
