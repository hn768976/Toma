/** midpointDisplacement: the same generator at four parameter sets. */
import React, { useCallback } from 'react';
import { AbsoluteFill } from 'remotion';
import { midpointDisplacement, polyline } from '../../../src/generators';
import { neonStroke } from '../../../src/strokes';
import { mulberry32 } from '../../../src/random';
import { Canvas, type DrawFn } from '../Canvas';
import { Label } from '../Label';
import { THEME } from '../theme';

const PRESETS = [
  { name: 'lightning', depth: 7, displacement: 0.32, branchProbability: 0.4, branchAngle: 0.5, color: THEME.accent },
  { name: 'plasma', depth: 6, displacement: 0.55, branchProbability: 0.7, branchAngle: 1.1, color: THEME.rose },
  { name: 'bronchi', depth: 5, displacement: 0.1, branchProbability: 1.0, branchAngle: 0.6, color: THEME.green },
  { name: 'roots', depth: 6, displacement: 0.22, branchProbability: 0.8, branchAngle: 0.9, color: THEME.amber },
] as const;

export const MidpointDemo: React.FC = () => {
  const draw: DrawFn = useCallback((ctx, frame, width, height) => {
    ctx.fillStyle = THEME.bg;
    ctx.fillRect(0, 0, width, height);

    PRESETS.forEach((preset, i) => {
      const cx = 240 + i * 480;
      // Reseeded per frame block so the form re-strikes rather than crawling.
      const rng = mulberry32(1000 + i * 31 + Math.floor(frame / 30));
      const { strokes } = midpointDisplacement({
        start: { x: cx, y: 180 },
        end: { x: cx + 40, y: 820 },
        rng,
        depth: preset.depth,
        displacement: preset.displacement,
        branchProbability: preset.branchProbability,
        branchAngle: preset.branchAngle,
      });

      for (const s of strokes) {
        neonStroke({
          ctx,
          path: (c) => polyline(c, s.points),
          color: preset.color,
          coreColor: '#FFFFFF',
          width: 2.6 * s.width,
          intensity: s.brightness,
        });
      }

      ctx.font = '20px ui-monospace, monospace';
      ctx.fillStyle = THEME.text;
      ctx.textAlign = 'center';
      ctx.fillText(preset.name, cx + 20, 900);
    });
  }, []);

  return (
    <AbsoluteFill style={{ backgroundColor: THEME.bg }}>
      <Canvas draw={draw} />
      <Label title="generators/midpointDisplacement" note="One function. Four parameter sets — lightning, plasma, bronchi, roots." />
    </AbsoluteFill>
  );
};
