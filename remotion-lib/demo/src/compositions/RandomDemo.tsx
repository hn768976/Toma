/** radialPlaces + irregularDashes: jitter on vs off, dashes even vs varied. */
import React, { useCallback } from 'react';
import { AbsoluteFill } from 'remotion';
import { mulberry32, radialPlaces, irregularDashes } from '../../../src/random';
import { neonFill } from '../../../src/strokes';
import { Canvas, type DrawFn } from '../Canvas';
import { Label } from '../Label';
import { THEME } from '../theme';

export const RandomDemo: React.FC = () => {
  const draw: DrawFn = useCallback((ctx, frame, width, height) => {
    ctx.fillStyle = THEME.bg;
    ctx.fillRect(0, 0, width, height);

    const spin = frame * 0.01;

    // LEFT: no jitter — the rosette / wheel this exists to avoid.
    for (const p of radialPlaces({
      count: 18, cx: 520, cy: 420, radius: 210,
      rng: mulberry32(7), angleJitter: 0, radiusJitter: 0, startAngle: spin,
    })) {
      neonFill({ ctx, cx: p.x, cy: p.y, radius: 5, color: THEME.rose, coreColor: '#FFF' });
    }

    // RIGHT: both axes jittered.
    for (const p of radialPlaces({
      count: 18, cx: 1400, cy: 420, radius: 210,
      rng: mulberry32(7), startAngle: spin,
    })) {
      neonFill({ ctx, cx: p.x, cy: p.y, radius: 5, color: THEME.cyan, coreColor: '#FFF' });
    }

    // Dashes: even ladder above, irregular below.
    ctx.save();
    ctx.strokeStyle = THEME.rose;
    ctx.lineWidth = 5;
    ctx.setLineDash([18, 12]);
    ctx.beginPath();
    ctx.moveTo(360, 760);
    ctx.lineTo(1560, 760);
    ctx.stroke();

    const { pattern } = irregularDashes({ count: 24, rng: mulberry32(19) });
    ctx.strokeStyle = THEME.cyan;
    ctx.setLineDash(pattern);
    ctx.beginPath();
    ctx.moveTo(360, 840);
    ctx.lineTo(1560, 840);
    ctx.stroke();
    ctx.restore();

    ctx.font = '20px ui-monospace, monospace';
    ctx.fillStyle = THEME.text;
    ctx.textAlign = 'center';
    ctx.fillText('regular — reads as a wheel', 520, 690);
    ctx.fillText('radialPlaces — angle + radius jitter', 1400, 690);
    ctx.textAlign = 'left';
    ctx.fillText('even dashes — a ladder', 360, 735);
    ctx.fillText('irregularDashes', 360, 815);
  }, []);

  return (
    <AbsoluteFill style={{ backgroundColor: THEME.bg }}>
      <Canvas draw={draw} />
      <Label title="random/radialPlaces + irregularDashes" note="Breaking symmetry and breaking the beat. Both seeded, both deterministic." />
    </AbsoluteFill>
  );
};
