import React, {useLayoutEffect} from 'react';
import {clamp, clearCanvas, context2d, fitFontSize, mixHex, rgba} from '../lib/util';
import type {LayerProps} from './BandLayer';

const FONT_STACK = '"Liberation Sans", "DejaVu Sans", Arial, Helvetica, sans-serif';
const fontOf = (size: number) => `700 ${size}px ${FONT_STACK}`;

interface CentreLabelProps extends LayerProps {
  /** "breach" glitch frames split the label's colour channels by this many px. */
  channelSplit: number;
  channelWarm: string;
  channelCool: string;
}

const drawLine = (
  ctx: CanvasRenderingContext2D,
  text: string,
  size: number,
  x: number,
  y: number,
  color: string,
  alpha: number,
  glow: number,
  channelSplit: number,
  channelWarm: string,
  channelCool: string
): void => {
  if (alpha <= 0.002) return;
  ctx.font = fontOf(size);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  ctx.save();
  ctx.globalAlpha = alpha;

  // Soft halo behind the glyphs; its radius is what the ±10% pulse rides on.
  ctx.save();
  ctx.globalAlpha = alpha * 0.55;
  ctx.shadowColor = rgba(color, 1);
  ctx.shadowBlur = size * 0.5 * glow;
  ctx.fillStyle = rgba(color, 0.9);
  ctx.fillText(text, x, y);
  ctx.restore();

  // Crisp glyphs on top so the word stays legible through the bloom.
  ctx.fillStyle = color;
  ctx.fillText(text, x, y);

  if (channelSplit > 0) {
    // Chromatic split: warm copy left, cool copy right, added over the core.
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = alpha * 0.7;
    ctx.fillStyle = mixHex(color, channelWarm, 0.7);
    ctx.fillText(text, x - channelSplit, y);
    ctx.fillStyle = mixHex(color, channelCool, 0.7);
    ctx.fillText(text, x + channelSplit, y);
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = alpha;
    ctx.fillStyle = color;
    ctx.fillText(text, x, y);
  }

  ctx.restore();
};

export const CentreLabel: React.FC<CentreLabelProps> = ({
  canvas,
  variant,
  frame,
  cx,
  cy,
  R,
  channelSplit,
  channelWarm,
  channelCool,
}) => {
  useLayoutEffect(() => {
    const ctx = context2d(canvas);
    clearCanvas(ctx);

    const cfg = variant.label;
    const {palette} = variant;

    // Keep both lines comfortably inside the shape that contains them.
    const maxWidth = R * cfg.maxWidthFactor;
    const upperSize = fitFontSize(ctx, cfg.upper, fontOf, cfg.upperSize, maxWidth);
    const lowerSize = fitFontSize(ctx, cfg.lower, fontOf, cfg.lowerSize, maxWidth);

    const gap = upperSize * 0.28;
    const blockHeight = upperSize + gap + lowerSize;
    const top = cy + cfg.offsetY - blockHeight / 2;
    const upperY = top + upperSize / 2;
    const lowerY = top + upperSize + gap + lowerSize / 2;

    const upperAlpha = clamp((frame - cfg.upperInFrame) / cfg.fadeFrames);
    const lowerAlpha = clamp((frame - cfg.lowerInFrame) / cfg.fadeFrames);

    // ±glowAmount on a sine whose period divides the idle stretch evenly.
    const glow =
      1 + cfg.glowAmount * Math.sin((frame / cfg.glowPeriod) * Math.PI * 2);

    const split = [channelSplit, channelWarm, channelCool] as const;
    drawLine(ctx, cfg.upper, upperSize, cx, upperY, palette.labelA, upperAlpha, glow, ...split);
    drawLine(ctx, cfg.lower, lowerSize, cx, lowerY, palette.labelB, lowerAlpha, glow, ...split);

    // Three typing dots — the detail that ties "chat" to its subject.
    const dots = cfg.typingDots;
    if (dots && lowerAlpha > 0) {
      const totalWidth = (dots.count - 1) * dots.gap;
      for (let i = 0; i < dots.count; i++) {
        const phase = ((frame - i * dots.stagger) % dots.cycle + dots.cycle) % dots.cycle;
        // Each dot lifts and brightens for the first third of its cycle.
        const lift = phase < dots.cycle / 3
          ? Math.sin((phase / (dots.cycle / 3)) * Math.PI)
          : 0;
        const x = cx - totalWidth / 2 + i * dots.gap;
        const y = cy + dots.offsetY - lift * dots.rise;

        ctx.save();
        ctx.globalAlpha = lowerAlpha * (0.42 + lift * 0.58);
        ctx.fillStyle = palette[dots.color];
        ctx.shadowColor = rgba(palette[dots.color], 0.8);
        ctx.shadowBlur = 18 * glow * lift;
        ctx.beginPath();
        ctx.arc(x, y, dots.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    }
  });

  return null;
};
