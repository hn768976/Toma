import {CONFIG} from '../config';
import {MotifKind} from '../theme';
import {roundRectPath} from './canvas';

/**
 * The cluster beside the badge, and on the few cards that echo it.
 *
 * Two forms, chosen by the theme: vertical bars — an audio-waveform motif — or
 * three dots in a row, the standard typing indicator. The waveform says voice;
 * the dots say messaging. Every other element in the scene is a message card, so
 * the dots agree with the imagery where the bars quietly contradicted it.
 */

/** One dot's state within its bounce: 0 at rest, 1 at the top. */
export interface DotState {
  lift: number;
  brightness: number;
}

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

export const paintDotRow = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  dots: readonly DotState[],
  color: string,
): void => {
  // Sized so the row spans the same box the bars occupied.
  const gap = width / (dots.length * 4.2);
  const diameter = (width - gap * (dots.length - 1)) / dots.length;
  const radius = diameter / 2;
  const centreY = y + height / 2;

  ctx.save();
  ctx.fillStyle = color;
  for (let i = 0; i < dots.length; i++) {
    const cx = x + i * (diameter + gap) + radius;
    ctx.globalAlpha = dots[i].brightness;
    ctx.beginPath();
    ctx.arc(cx, centreY - dots[i].lift * CONFIG.hero.dotLift, radius, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
};

/**
 * Where each dot sits in the bounce on a given frame. Staggered so the row reads
 * as a wave travelling left to right, then a pause before it repeats.
 */
export const dotStatesAtFrame = (frame: number): DotState[] => {
  const {dotCount, dotPeriodFrames, dotStaggerFrames, dotActiveFrames, dotRestBrightness} =
    CONFIG.hero;
  return Array.from({length: dotCount}, (_, i) => {
    const offset = frame - i * dotStaggerFrames;
    const t = ((offset % dotPeriodFrames) + dotPeriodFrames) % dotPeriodFrames;
    const bounce = t < dotActiveFrames ? Math.sin((t / dotActiveFrames) * Math.PI) : 0;
    return {
      lift: bounce,
      brightness: dotRestBrightness + (1 - dotRestBrightness) * bounce,
    };
  });
};

/** Dispatch on the theme's motif. Bars ignore `dots`, dots ignore `heights`. */
export const paintMotif = (
  ctx: CanvasRenderingContext2D,
  kind: MotifKind,
  x: number,
  y: number,
  width: number,
  height: number,
  color: string,
  heights: readonly number[],
  dots: readonly DotState[],
): void => {
  if (kind === 'dots') {
    paintDotRow(ctx, x, y, width, height, dots, color);
    return;
  }
  paintBarCluster(ctx, x, y, width, height, heights, color);
};
