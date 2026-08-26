import {roundRectPath} from './canvas';

/**
 * The cyan bar cluster — an audio-waveform motif. It appears beside the hero
 * badge, where it animates, and statically on a few of the surrounding cards.
 */
export const paintBarCluster = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  heights: readonly number[],
  color: string,
): void => {
  const gap = width / (heights.length * 3.1);
  const barWidth = (width - gap * (heights.length - 1)) / heights.length;
  ctx.fillStyle = color;
  for (let i = 0; i < heights.length; i++) {
    const h = Math.max(barWidth * 0.9, height * heights[i]);
    const bx = x + i * (barWidth + gap);
    const by = y + (height - h);
    roundRectPath(ctx, bx, by, barWidth, h, barWidth / 2);
    ctx.fill();
  }
};
