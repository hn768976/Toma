import { interpolate } from 'remotion';
import { CONFIG, HEIGHT, WIDTH } from '../config';
import { alpha } from '../plane';
import { drawTabular, groupDigits } from '../text';
import type { Scene } from '../scene';

/**
 * CounterStack — cumulative figures in the upper-left, over the silhouette.
 *
 * Each line is larger than the one above it. All of them ride the same eased
 * progress as the curve, so the stack and the line feel coupled, and they
 * reroll every frame — this is the piece's constant micro-motion.
 */
export const drawCounterStack = (
  ctx: CanvasRenderingContext2D,
  scene: Scene,
  fontFamily: string
) => {
  const p = scene.v.palette;
  const rows = scene.v.counters;
  const x = CONFIG.counterX * WIDTH;
  let y = CONFIG.counterY * HEIGHT;

  ctx.textBaseline = 'middle';
  for (let i = 0; i < rows.length; i++) {
    const size = CONFIG.counterBaseSize * Math.pow(CONFIG.counterGrowth, i);
    const [from, to] = rows[i];
    const value = interpolate(scene.progress, [0, 1], [from, to]);
    const op = 0.34 + (i / Math.max(1, rows.length - 1)) * 0.6;

    ctx.font = `600 ${size}px ${fontFamily}`;
    ctx.fillStyle = alpha(p.labelWhite, op);
    ctx.shadowColor = alpha(p.backgroundDeep, 0.85);
    ctx.shadowBlur = 22;
    y += size * 0.72;
    drawTabular(ctx, groupDigits(value), x, y);
    ctx.shadowBlur = 0;

    // A hairline under each figure ties the column to the plane.
    ctx.strokeStyle = alpha(p.labelWhite, op * 0.22);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x, y + size * 0.56);
    ctx.lineTo(x + size * 4.2, y + size * 0.56);
    ctx.stroke();
    y += size * 0.62;
  }
};

/** The country name, set on a slab that sits on the plane beside the shape. */
export const drawCountryLabel = (
  ctx: CanvasRenderingContext2D,
  scene: Scene,
  fontFamily: string
) => {
  const p = scene.v.palette;
  const size = 104;
  ctx.font = `700 ${size}px ${fontFamily}`;
  ctx.textBaseline = 'middle';
  const text = scene.v.label;
  const w = ctx.measureText(text).width;
  const padX = 56;
  const padY = 38;
  const x = 0.6 * WIDTH;
  const y = 0.63 * HEIGHT;

  ctx.fillStyle = alpha(p.cardTint, 0.82);
  ctx.fillRect(x, y - size / 2 - padY, w + padX * 2, size + padY * 2);
  ctx.strokeStyle = alpha(p.gridLine, 0.9);
  ctx.lineWidth = 2.5;
  ctx.strokeRect(x, y - size / 2 - padY, w + padX * 2, size + padY * 2);
  ctx.fillStyle = alpha(p.labelWhite, 0.96);
  ctx.fillText(text, x + padX, y);
};
