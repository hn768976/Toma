import {useLayoutEffect, useMemo} from 'react';
import {random} from 'remotion';
import {
  BANNER_FONT_SIZE,
  BANNER_H_RATIO,
  BANNER_PAD_X,
  BANNER_TRACKING,
  BANNER_W_RATIO,
  HEIGHT,
  WIDTH,
} from '../lib/constants';
import {createBuffer, ctx2d, drawTrackedText, trackedWidth} from '../lib/draw';
import {bannerFont} from '../fonts';
import type {Stage} from '../stage';

/**
 * Layer 3 — a solid black bar with heavy italic caps. The italic is the point:
 * it is the only slanted thing on a screen of upright monospace, which is what
 * gives it urgency. The bar keeps its cap height and height across variants and
 * only widens if the longer word demands it, so the two cuts sit together.
 */
export const Banner: React.FC<{stage: Stage}> = ({stage}) => {
  const metrics = useMemo(() => {
    const m = ctx2d(createBuffer(8, 8));
    m.font = bannerFont(BANNER_FONT_SIZE);
    const textWidth = trackedWidth(m, stage.cfg.banner, BANNER_TRACKING);
    const barWidth = Math.max(WIDTH * BANNER_W_RATIO, textWidth + BANNER_PAD_X * 2);
    const barHeight = HEIGHT * BANNER_H_RATIO;
    return {textWidth, barWidth, barHeight};
  }, [stage.cfg.banner]);

  useLayoutEffect(() => {
    const canvas = stage.canvasRef.current;
    if (!canvas || !stage.ready) return;
    const ctx = ctx2d(canvas);
    const {palette, glitch} = stage.cfg;
    const inst = stage.instability;

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
    ctx.filter = 'none';

    // Fast, irregular schedule: a new offset roughly every other frame, with
    // some steps held still so it never settles into a rhythm.
    const step = Math.floor(stage.f / 2);
    const held = random(`${stage.cfg.name}-hold-${step}`) < 0.25 ? 0 : 1;
    const barJx = (random(`${stage.cfg.name}-bx-${step}`) * 2 - 1) * glitch.bannerJitter * inst * held;
    const textJx =
      (random(`${stage.cfg.name}-tx-${step}`) * 2 - 1) * glitch.bannerJitter * inst * held;

    const barX = (WIDTH - metrics.barWidth) / 2 + barJx;
    const barY = (HEIGHT - metrics.barHeight) / 2;

    ctx.fillStyle = palette.bannerBlack;
    ctx.fillRect(barX, barY, metrics.barWidth, metrics.barHeight);

    ctx.font = bannerFont(BANNER_FONT_SIZE);
    ctx.textBaseline = 'middle';
    const textLeft = (WIDTH - metrics.textWidth) / 2 + textJx;
    // Optical centring: italic caps sit high against a 'middle' baseline.
    const baseline = HEIGHT / 2 + BANNER_FONT_SIZE * 0.03;

    // Persistent chromatic fringe: one channel each way, additively composited,
    // with the white core laid over the top.
    const fringe = 2 + glitch.chromatic * inst;
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.8;
    ctx.fillStyle = palette.fringeA;
    drawTrackedText(ctx, stage.cfg.banner, textLeft - fringe, baseline, BANNER_TRACKING);
    ctx.fillStyle = palette.fringeB;
    drawTrackedText(ctx, stage.cfg.banner, textLeft + fringe, baseline, BANNER_TRACKING);

    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
    // Very slight bloom, on the banner text only.
    ctx.shadowColor = palette.bannerWhite;
    ctx.shadowBlur = 14;
    ctx.fillStyle = palette.bannerWhite;
    drawTrackedText(ctx, stage.cfg.banner, textLeft, baseline, BANNER_TRACKING);
    ctx.shadowBlur = 0;
    drawTrackedText(ctx, stage.cfg.banner, textLeft, baseline, BANNER_TRACKING);

    ctx.textBaseline = 'alphabetic';
  });

  return null;
};
