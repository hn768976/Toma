import React from 'react';
import {useDrawOp} from '../ops';
import {alpha, shade, type Palette} from '../palettes';
import {
  bucketWeightStops,
  PLANE_H,
  PLANE_W,
  type Bucket,
} from '../plane';
import type {Tilt} from '../types';

const PITCH = 90;
const BASE_ALPHA = 1;
const FOURTH_MUL = 1.85;

/**
 * The faint grid that covers the whole plane. It spans every depth, so it is
 * drawn into all three buffers with cross-fading weights — the blurred copies
 * then ramp smoothly instead of stepping at bucket boundaries.
 */
export const GridPlane: React.FC<{
  palette: Palette;
  tilt: Tilt;
  z: number;
}> = ({palette, tilt, z}) => {
  const weightAt = (bucket: Bucket, d: number): number => {
    const stops = bucketWeightStops(bucket);
    for (let i = 0; i < stops.length - 1; i++) {
      const a = stops[i];
      const b = stops[i + 1];
      if (d >= a.d && d <= b.d) {
        const t = b.d === a.d ? 0 : (d - a.d) / (b.d - a.d);
        return a.w + (b.w - a.w) * t;
      }
    }
    return stops[stops.length - 1].w;
  };

  const drawFor = (bucket: Bucket) => (ctx: CanvasRenderingContext2D) => {
    ctx.save();
    ctx.lineWidth = 1.4;

    // Horizontal lines run across the whole depth range: one stroke each, with
    // a gradient carrying this bucket's weight.
    const stops = bucketWeightStops(bucket);
    const rows = Math.ceil(PLANE_H / PITCH);
    for (let i = 0; i <= rows; i++) {
      const y = i * PITCH;
      const fourth = i % 4 === 0;
      const tone = (a: number) =>
        fourth ? shade(palette.grid, FOURTH_MUL, a) : alpha(palette.grid, a);
      const g = ctx.createLinearGradient(0, y, PLANE_W, y);
      const mapped = stops
        .map((s) => ({o: tilt === 'right' ? s.d : 1 - s.d, w: s.w}))
        .sort((p, q) => p.o - q.o);
      for (const s of mapped) {
        g.addColorStop(Math.max(0, Math.min(1, s.o)), tone(BASE_ALPHA * s.w));
      }
      ctx.strokeStyle = g;
      ctx.lineWidth = fourth ? 1.9 : 1.3;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(PLANE_W, y);
      ctx.stroke();
    }

    // Vertical lines sit at one depth each: a flat weight per line.
    const cols = Math.ceil(PLANE_W / PITCH);
    for (let i = 0; i <= cols; i++) {
      const x = i * PITCH;
      const d = tilt === 'right' ? x / PLANE_W : 1 - x / PLANE_W;
      const w = weightAt(bucket, d);
      if (w <= 0.002) continue;
      const fourth = i % 4 === 0;
      ctx.strokeStyle = fourth
        ? shade(palette.grid, FOURTH_MUL, BASE_ALPHA * w)
        : alpha(palette.grid, BASE_ALPHA * w);
      ctx.lineWidth = fourth ? 1.9 : 1.3;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, PLANE_H);
      ctx.stroke();
    }
    ctx.restore();
  };

  useDrawOp({bucket: 0, z, draw: drawFor(0)});
  useDrawOp({bucket: 1, z, draw: drawFor(1)});
  return useDrawOp({bucket: 2, z, draw: drawFor(2)});
};

