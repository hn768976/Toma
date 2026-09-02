/**
 * A soft halo hugging the symbol's outline.
 *
 * Built once by blurring the shape's dilated mask, then blitted additively
 * each frame at a pulsing opacity. Its period differs from the outer ring's,
 * so the two are never in step — but both divide the loop, so the pair still
 * closes exactly at the end.
 *
 * Like every layer but <SymbolShape>, this one only ever sees an anonymous
 * mask; it has no idea what shape it is glowing around.
 */

import React, { useMemo } from "react";
import { createLayer, hexToRgb, rgba } from "./canvas";

export interface RimGlowProps {
  ctx: CanvasRenderingContext2D;
  /** Mask grown a little past the shape's outline. */
  mask: HTMLCanvasElement;
  color: string;
  /** Blur radius, in mask pixels. */
  blur: number;
  /** Opacity at rest; the caller pulses this. */
  intensity: number;
  centerX: number;
  centerY: number;
}

const glowCache = new Map<string, HTMLCanvasElement>();

const getGlow = (
  mask: HTMLCanvasElement,
  color: string,
  blur: number,
): HTMLCanvasElement => {
  const key = `${color}-${blur}-${mask.width}`;
  const cached = glowCache.get(key);
  if (cached) return cached;

  const { canvas, ctx } = createLayer(mask.width, mask.height);
  ctx.filter = `blur(${blur}px)`;
  ctx.drawImage(mask, 0, 0);
  ctx.filter = "none";
  ctx.globalCompositeOperation = "source-in";
  ctx.fillStyle = rgba(hexToRgb(color), 1);
  ctx.fillRect(0, 0, mask.width, mask.height);

  glowCache.set(key, canvas);
  return canvas;
};

export const RimGlow: React.FC<RimGlowProps> = ({
  ctx,
  mask,
  color,
  blur,
  intensity,
  centerX,
  centerY,
}) => {
  const glow = useMemo(() => getGlow(mask, color, blur), [mask, color, blur]);
  const half = mask.width / 2;

  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  ctx.globalAlpha = Math.max(0, intensity);
  ctx.drawImage(glow, centerX - half, centerY - half);
  ctx.restore();

  return null;
};
