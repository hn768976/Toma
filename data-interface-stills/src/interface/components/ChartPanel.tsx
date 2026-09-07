import React from 'react';
import {useDrawOp} from '../ops';
import {alpha} from '../palettes';
import {axisTicks, clipTo, faintGrid, insetRect, labelTab, panelFrame} from '../draw';
import {jaggedProfile, type BlockProps} from './shared';

export type ChartKind = 'area' | 'bar' | 'line';

/**
 * One of three chart forms, chosen by seed so panels differ across a layout:
 * a filled area with a jagged profile, bars of varied height, or a line trace
 * on a faint grid. All values are fictional.
 */
export const ChartPanel: React.FC<BlockProps> = ({
  rect,
  palette,
  rng,
  density,
  scale,
  bucket,
  z,
}) => {
  const kind: ChartKind = rng.pick(['area', 'bar', 'line'] as const);
  const label = `${rng.code(3)}${rng.code(2, '0123456789')}`;
  const tabH = Math.min(34, Math.max(15, rect.h * 0.09));
  const samples = Math.max(
    8,
    Math.round((kind === 'bar' ? rect.w / (26 * scale) : rect.w / (11 * scale)) * density.fill),
  );
  const profile = jaggedProfile(
    rng.fork('profile'),
    samples,
    kind === 'line' ? 0.62 : kind === 'area' ? 0.34 : 0.2,
  );
  const tickEdges = rng.bool(0.5) ? (['bottom', 'left'] as const) : (['bottom'] as const);

  return useDrawOp({
    bucket,
    z,
    draw: (ctx) => {
      ctx.save();
      panelFrame(ctx, rect, palette, {lineWidth: 2, wash: 0.2});
      labelTab(ctx, rect, palette, label, {corner: 'tl', height: tabH});

      const plot = {
        x: rect.x + rect.w * 0.07,
        y: rect.y + tabH + rect.h * 0.08,
        w: rect.w * 0.86,
        h: Math.max(8, rect.h - tabH - rect.h * 0.22),
      };
      clipTo(ctx, insetRect(rect, 3));

      if (kind === 'line') faintGrid(ctx, plot, palette, 8, 5);

      const px = (i: number) => plot.x + (i / (samples - 1)) * plot.w;
      const py = (v: number) => plot.y + plot.h * (1 - v);

      if (kind === 'area') {
        ctx.beginPath();
        ctx.moveTo(plot.x, plot.y + plot.h);
        profile.forEach((v, i) => ctx.lineTo(px(i), py(v)));
        ctx.lineTo(plot.x + plot.w, plot.y + plot.h);
        ctx.closePath();
        ctx.fillStyle = alpha(palette.tones[0], 0.6);
        ctx.fill();
        ctx.lineWidth = 2.2 * scale;
        ctx.strokeStyle = alpha(palette.tones[1], 0.8);
        ctx.beginPath();
        profile.forEach((v, i) => (i === 0 ? ctx.moveTo(px(i), py(v)) : ctx.lineTo(px(i), py(v))));
        ctx.stroke();
      } else if (kind === 'bar') {
        const bw = plot.w / samples;
        profile.forEach((v, i) => {
          const hot = i % 7 === 3;
          ctx.fillStyle = alpha(palette.tones[hot ? 2 : 1], hot ? 0.8 : 0.5);
          ctx.fillRect(plot.x + i * bw + bw * 0.26, py(v), bw * 0.48, plot.h * v);
        });
      } else {
        ctx.lineWidth = 2.4 * scale;
        ctx.strokeStyle = alpha(palette.tones[2], 0.78);
        ctx.beginPath();
        profile.forEach((v, i) => (i === 0 ? ctx.moveTo(px(i), py(v)) : ctx.lineTo(px(i), py(v))));
        ctx.stroke();
        // A dimmer companion trace, so the panel is a comparison, not a graph.
        ctx.lineWidth = 1.7 * scale;
        ctx.strokeStyle = alpha(palette.tones[0], 0.9);
        ctx.beginPath();
        profile.forEach((v, i) => {
          const y = py(Math.max(0.05, v * 0.55));
          if (i === 0) ctx.moveTo(px(i), y);
          else ctx.lineTo(px(i), y);
        });
        ctx.stroke();
      }

      for (const edge of tickEdges) {
        axisTicks(ctx, plot, palette, edge, Math.max(6, Math.round(samples / 3)), rect.h * 0.03);
      }
      ctx.restore();
    },
  });
};
