/** trendingWalk: biased runs vs a plain random walk. */
import React, { useCallback } from 'react';
import { AbsoluteFill } from 'remotion';
import { trendingWalk } from '../../../src/generators';
import { mulberry32 } from '../../../src/random';
import { neonStroke } from '../../../src/strokes';
import { Canvas, type DrawFn } from '../Canvas';
import { Label } from '../Label';
import { THEME } from '../theme';

export const TrendingWalkDemo: React.FC = () => {
  const draw: DrawFn = useCallback((ctx, frame, width, height) => {
    ctx.fillStyle = THEME.bg;
    ctx.fillRect(0, 0, width, height);

    const reveal = Math.min(1, (frame % 90) / 70);

    // Candles from a biased-run series.
    const { candles, min, max } = trendingWalk({
      rng: mulberry32(77), length: 96, bias: 1, runLength: [7, 20], volatility: 0.014,
    });
    const x0 = 150, x1 = 1770, yTop = 150, yBot = 620;
    const span = Math.max(1e-6, max - min);
    const toY = (v: number) => yBot - ((v - min) / span) * (yBot - yTop);
    const cw = (x1 - x0) / candles.length;
    const shown = Math.floor(candles.length * reveal);

    for (let i = 0; i < shown; i++) {
      const c = candles[i];
      const cx = x0 + i * cw + cw / 2;
      const color = c.rising ? THEME.green : THEME.rose;
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(cx, toY(c.high));
      ctx.lineTo(cx, toY(c.low));
      ctx.stroke();
      ctx.fillStyle = color;
      const top = toY(Math.max(c.open, c.close));
      const h = Math.max(1.5, Math.abs(toY(c.open) - toY(c.close)));
      ctx.fillRect(cx - cw * 0.34, top, cw * 0.68, h);
    }

    // Below: an unbiased walk, for contrast — flat noise.
    const flat = trendingWalk({
      rng: mulberry32(77), length: 96, bias: 0, biasStrength: 0,
      runLength: [1, 1], volatility: 0.014,
    });
    const fMin = Math.min(...flat.values), fMax = Math.max(...flat.values);
    const fSpan = Math.max(1e-6, fMax - fMin);
    neonStroke({
      ctx,
      path: (c) => {
        c.beginPath();
        flat.values.forEach((v, i) => {
          const x = x0 + (i / (flat.values.length - 1)) * (x1 - x0);
          const y = 900 - ((v - fMin) / fSpan) * 150;
          if (i === 0) c.moveTo(x, y); else c.lineTo(x, y);
        });
      },
      color: THEME.text, coreColor: '#FFFFFF', width: 1.6, intensity: 0.5,
    });

    ctx.font = '19px ui-monospace, monospace';
    ctx.fillStyle = THEME.text;
    ctx.fillText('trendingWalk — biased runs, recognisable structure', 150, 680);
    ctx.fillText('runLength [1,1], no bias — flat noise', 150, 960);
  }, []);

  return (
    <AbsoluteFill style={{ backgroundColor: THEME.bg }}>
      <Canvas draw={draw} />
      <Label title="generators/trendingWalk" note="Committing to runs is what makes a series read as a market, not a seismograph." />
    </AbsoluteFill>
  );
};
