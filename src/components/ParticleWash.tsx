import React, {useLayoutEffect} from 'react';
import {clamp, clearCanvas, context2d, rgba, rnd} from '../lib/util';
import type {LayerProps} from './BandLayer';

/** Fine particles drifting slowly across the whole frame, start to finish. */
export const ParticleWash: React.FC<LayerProps> = ({
  canvas,
  variant,
  frame,
  durationInFrames,
}) => {
  useLayoutEffect(() => {
    const ctx = context2d(canvas);
    clearCanvas(ctx);

    const {width, height} = canvas;
    const cfg = variant.particles;
    const color = variant.palette[cfg.color];
    const fade = clamp(frame / 40);

    for (let i = 0; i < cfg.count; i++) {
      const angle = rnd(`p-dir-${i}`, 0, Math.PI * 2);
      const speed = cfg.speed * rnd(`p-speed-${i}`, 0.4, 1.8);
      const margin = 120;
      const span = width + margin * 2;
      const spanY = height + margin * 2;

      const x =
        (((rnd(`p-x-${i}`, 0, span) + Math.cos(angle) * speed * frame) % span) + span) %
          span -
        margin;
      const y =
        (((rnd(`p-y-${i}`, 0, spanY) + Math.sin(angle) * speed * frame) % spanY) + spanY) %
          spanY -
        margin;

      const size = rnd(`p-size-${i}`, 1.6, 5.2);
      const twinkle =
        0.55 +
        0.45 * Math.sin((frame / rnd(`p-period-${i}`, 55, 190)) * Math.PI * 2 + i);

      ctx.globalAlpha = cfg.alpha * twinkle * fade * rnd(`p-a-${i}`, 0.35, 1);
      ctx.fillStyle = rgba(color, 1);
      ctx.beginPath();
      ctx.arc(x, y, size, 0, Math.PI * 2);
      ctx.fill();
    }
    void durationInFrames;
  });

  return null;
};
