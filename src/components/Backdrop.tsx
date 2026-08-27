import React, {useLayoutEffect} from 'react';
import {getUnitOutline, tracePathRange} from '../lib/geometry';
import {clearCanvas, context2d, rgba} from '../lib/util';
import type {LayerProps} from './BandLayer';

/**
 * The large, faint arc shapes sitting behind the assembly — a bigger
 * structure implied but never resolved. They use the same shape primitive as
 * the bands, so the "chat" variant gets bubble-shaped backdrop arcs for free.
 */
export const Backdrop: React.FC<LayerProps> = ({
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
    const fade = Math.min(1, Math.max(0, (frame - 4) / 26));
    if (fade <= 0) return;

    ctx.save();
    ctx.translate(cx, cy);
    ctx.lineCap = 'round';

    variant.backdropArcs.forEach((arc, i) => {
      // A very slow counter-drift keeps the backdrop from feeling pinned.
      const drift =
        ((i % 2 === 0 ? 1 : -1) * frame * 0.012 * Math.PI * 2) / 360;
      ctx.save();
      ctx.rotate(drift);
      ctx.globalAlpha = arc.alpha * fade;
      ctx.lineWidth = arc.thickness;
      ctx.strokeStyle = rgba(variant.palette.bright, 1);
      tracePathRange(
        ctx,
        outline,
        arc.radius * R,
        arc.startDeg / 360,
        (arc.startDeg + arc.sweepDeg) / 360
      );
      ctx.stroke();
      ctx.restore();
    });

    ctx.restore();
    void durationInFrames;
  });

  return null;
};
