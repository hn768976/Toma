import React, {useLayoutEffect} from 'react';
import type {BandDef, Variant} from '../variants';
import {getUnitOutline, pointAt, tracePath, tracePathRange} from '../lib/geometry';
import type {Outline} from '../lib/geometry';
import {bandMotion} from '../lib/motion';
import {clearCanvas, context2d, rgba, rnd} from '../lib/util';

export interface LayerProps {
  canvas: HTMLCanvasElement;
  variant: Variant;
  frame: number;
  durationInFrames: number;
  cx: number;
  cy: number;
  /** Assembly radius in pixels. */
  R: number;
}

/**
 * Renders whatever band array it is handed, against whatever shape primitive
 * the variant's geometry mode selects. It has no knowledge of circles or
 * bubbles beyond asking `getUnitOutline` for one.
 */
const drawBand = (
  ctx: CanvasRenderingContext2D,
  band: BandDef,
  outline: Outline,
  r: number,
  color: string,
  slate: string,
  white: string
): void => {
  ctx.lineJoin = 'round';

  switch (band.type) {
    case 'disc': {
      tracePath(ctx, outline, r);
      ctx.fillStyle = color;
      ctx.fill();
      ctx.lineWidth = 3;
      ctx.strokeStyle = rgba(slate, 0.7);
      ctx.stroke();
      break;
    }

    case 'ring': {
      tracePath(ctx, outline, r);
      ctx.lineWidth = band.thickness;
      ctx.strokeStyle = color;
      ctx.stroke();
      break;
    }

    case 'dash': {
      // The dash pattern rides the path identically for either primitive.
      ctx.setLineDash(band.dash ?? [20, 20]);
      ctx.lineCap = 'butt';
      tracePath(ctx, outline, r);
      ctx.lineWidth = band.thickness;
      ctx.strokeStyle = color;
      ctx.stroke();
      ctx.setLineDash([]);
      break;
    }

    case 'ticks':
    case 'bars': {
      const count = band.count ?? 48;
      const base = band.tickLength ?? 20;
      const vary = band.tickVary ?? 0;
      ctx.lineWidth = band.thickness;
      ctx.strokeStyle = color;
      ctx.lineCap = 'butt';
      ctx.beginPath();
      for (let i = 0; i < count; i++) {
        const p = pointAt(outline, i / count);
        const len = base + (vary > 0 ? rnd(`${band.id}-len-${i}`) * vary : 0);
        const x0 = p.x * r - p.nx * len * 0.25;
        const y0 = p.y * r - p.ny * len * 0.25;
        ctx.moveTo(x0, y0);
        ctx.lineTo(x0 + p.nx * len, y0 + p.ny * len);
      }
      ctx.stroke();
      break;
    }

    case 'arcs': {
      ctx.lineWidth = band.thickness;
      ctx.strokeStyle = color;
      ctx.lineCap = 'round';
      for (const [startDeg, sweepDeg] of band.arcs ?? []) {
        tracePathRange(ctx, outline, r, startDeg / 360, (startDeg + sweepDeg) / 360);
        ctx.stroke();
      }
      ctx.lineCap = 'butt';
      break;
    }
  }

  // Small bright dots riding the band's edge, turning with it.
  if (band.dots) {
    for (const t of band.dots) {
      const p = pointAt(outline, t);
      const x = p.x * r;
      const y = p.y * r;
      const glow = ctx.createRadialGradient(x, y, 0, x, y, 34);
      glow.addColorStop(0, rgba(white, 0.95));
      glow.addColorStop(0.28, rgba(white, 0.45));
      glow.addColorStop(1, rgba(white, 0));
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(x, y, 34, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = white;
      ctx.beginPath();
      ctx.arc(x, y, 8, 0, Math.PI * 2);
      ctx.fill();
    }
  }
};

export const BandLayer: React.FC<LayerProps> = ({
  canvas,
  variant,
  frame,
  durationInFrames,
  cx,
  cy,
  R,
}) => {
  useLayoutEffect(() => {
    const ctx = context2d(canvas);
    clearCanvas(ctx);

    const outline = getUnitOutline(variant.geometry);
    const {palette} = variant;

    variant.bands.forEach((band, index) => {
      const m = bandMotion(variant, band, index, frame, durationInFrames);
      if (m.scale <= 0.002 || m.alpha <= 0.002) return;

      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(m.rotation);
      ctx.globalAlpha = m.alpha;
      drawBand(
        ctx,
        band,
        outline,
        band.radius * R * m.scale,
        palette[band.color],
        palette.slate,
        palette.white
      );
      ctx.restore();
    });
  });

  return null;
};
