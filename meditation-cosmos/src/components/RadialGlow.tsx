import React from 'react';
import { Layer } from './Layer';
import { RGB, rgba } from '../lib/palette';

export type GlowStop = { at: number; colour: RGB; alpha: number };

type Props = {
  /** Centre, as fractions of the frame. */
  cx: number;
  cy: number;
  /** Outer radius, as a fraction of the frame height. */
  radius: number;
  stops: GlowStop[];
  /** Squash the glow horizontally (>1) or vertically (<1). */
  aspect?: number;
  res?: number;
  opacity?: number;
  blend?: React.CSSProperties['mixBlendMode'];
};

/** A soft additive light source. Always composited behind the silhouette. */
export const RadialGlow: React.FC<Props> = ({
  cx,
  cy,
  radius,
  stops,
  aspect = 1,
  res = 1 / 4,
  opacity = 1,
  blend = 'screen',
}) => (
  <Layer
    res={res}
    opacity={opacity}
    blend={blend}
    draw={(ctx, w, h) => {
      const r = radius * h;
      const x = cx * w;
      const y = cy * h;
      ctx.save();
      ctx.translate(x, y);
      ctx.scale(aspect, 1);
      const g = ctx.createRadialGradient(0, 0, 0, 0, 0, r);
      for (const s of stops) g.addColorStop(s.at, rgba(s.colour, s.alpha));
      ctx.fillStyle = g;
      ctx.fillRect(-r, -r, r * 2, r * 2);
      ctx.restore();
    }}
  />
);
