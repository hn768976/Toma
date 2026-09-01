/** blobPath + tornEdge. */
import React, { useCallback } from 'react';
import { AbsoluteFill } from 'remotion';
import { blobPath, tornEdge } from '../../../src/shapes';
import { mulberry32 } from '../../../src/random';
import { Canvas, type DrawFn } from '../Canvas';
import { Label } from '../Label';
import { THEME } from '../theme';

export const ShapesDemo: React.FC = () => {
  const draw: DrawFn = useCallback((ctx, frame, width, height) => {
    ctx.fillStyle = THEME.bg;
    ctx.fillRect(0, 0, width, height);

    // Blobs at rising irregularity — 0 is a circle, high is a cell.
    const levels = [0, 0.14, 0.28, 0.42];
    levels.forEach((irregularity, i) => {
      const { path } = blobPath({
        cx: 330 + i * 420, cy: 360, radius: 130,
        rng: mulberry32(11 + i),
        irregularity,
        rotation: frame * 0.006,
      });
      ctx.save();
      ctx.fillStyle = 'rgba(52,211,153,0.13)';
      ctx.fill(path);
      ctx.strokeStyle = THEME.green;
      ctx.lineWidth = 3;
      ctx.stroke(path);
      ctx.restore();

      ctx.font = '19px ui-monospace, monospace';
      ctx.fillStyle = THEME.text;
      ctx.textAlign = 'center';
      ctx.fillText(`irregularity ${irregularity}`, 330 + i * 420, 550);
    });

    // A torn edge with a fibre band.
    const { points, fibres } = tornEdge({
      from: { x: 140, y: 780 }, to: { x: 1780, y: 760 },
      rng: mulberry32(23), fibres: 260, coarseAmp: 18, fineAmp: 4,
    });
    ctx.save();
    ctx.strokeStyle = THEME.amber;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (const p of points.slice(1)) ctx.lineTo(p.x, p.y);
    ctx.stroke();

    ctx.globalAlpha = 0.45;
    ctx.lineWidth = 1.2;
    for (const f of fibres) {
      ctx.beginPath();
      ctx.moveTo(f.from.x, f.from.y);
      ctx.lineTo(f.to.x, f.to.y);
      ctx.stroke();
    }
    ctx.restore();

    ctx.font = '19px ui-monospace, monospace';
    ctx.fillStyle = THEME.text;
    ctx.textAlign = 'left';
    ctx.fillText('tornEdge — two noise scales + fibre band', 140, 860);
  }, []);

  return (
    <AbsoluteFill style={{ backgroundColor: THEME.bg }}>
      <Canvas draw={draw} />
      <Label title="shapes/blobPath + tornEdge" note="Bezier-smoothed across the seam; two noise scales make a tear, not a wobble." />
    </AbsoluteFill>
  );
};
