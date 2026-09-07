import React from 'react';
import {useDrawOp} from '../ops';
import {alpha} from '../palettes';
import {clipTo, insetRect, panelFrame} from '../draw';
import {jaggedProfile, type BlockProps} from './shared';

/** A single jagged trace across a wide short panel, with a centre line. */
export const WaveformPanel: React.FC<BlockProps> = ({
  rect,
  palette,
  rng,
  density,
  scale,
  bucket,
  z,
}) => {
  const samples = Math.max(24, Math.round((rect.w / (5 * scale)) * density.fill));
  const profile = jaggedProfile(rng.fork('wave'), samples, 0.14);

  return useDrawOp({
    bucket,
    z,
    draw: (ctx) => {
      ctx.save();
      panelFrame(ctx, rect, palette, {lineWidth: 2, wash: 0.18});
      const inner = insetRect(rect, Math.max(8, rect.h * 0.12));
      clipTo(ctx, insetRect(rect, 3));

      ctx.strokeStyle = alpha(palette.tones[0], 0.9);
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(inner.x, inner.y + inner.h / 2);
      ctx.lineTo(inner.x + inner.w, inner.y + inner.h / 2);
      ctx.stroke();

      ctx.strokeStyle = alpha(palette.tones[2], 0.78);
      ctx.lineWidth = Math.max(1.5, 1.9 * scale);
      ctx.beginPath();
      profile.forEach((v, i) => {
        const x = inner.x + (i / (samples - 1)) * inner.w;
        const y = inner.y + inner.h / 2 + (v - 0.5) * inner.h * 1.5;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.stroke();
      ctx.restore();
    },
  });
};
