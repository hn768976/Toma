/** particleFromMask: rejection sampling inside a silhouette, edge-weighted. */
import React, { useCallback, useMemo } from 'react';
import { AbsoluteFill } from 'remotion';
import { particleFromMask, type MaskParticle } from '../../../src/generators';
import { mulberry32 } from '../../../src/random';
import { Canvas, type DrawFn } from '../Canvas';
import { Label } from '../Label';
import { THEME } from '../theme';

/** A padlock outline — the shape the security projects kept rebuilding. */
const LOCK =
  'M300 250 h200 a30 30 0 0 1 30 30 v190 a30 30 0 0 1 -30 30 h-200 ' +
  'a30 30 0 0 1 -30 -30 v-190 a30 30 0 0 1 30 -30 z ' +
  'M330 250 v-70 a70 70 0 0 1 140 0 v70 h-40 v-70 a30 30 0 0 0 -60 0 v70 z';

export const ParticleMaskDemo: React.FC = () => {
  // Rasterise + distance transform once, never per frame.
  const uniform: MaskParticle[] = useMemo(
    () => particleFromMask({
      path: LOCK, count: 2600, rng: mulberry32(3),
      width: 800, height: 620, edgeBias: 0,
    }), []);
  const edged: MaskParticle[] = useMemo(
    () => particleFromMask({
      path: LOCK, count: 2600, rng: mulberry32(3),
      width: 800, height: 620, edgeBias: 0.8, edgeFalloff: 10,
    }), []);

  const draw: DrawFn = useCallback((ctx, frame, width, height) => {
    ctx.fillStyle = THEME.bg;
    ctx.fillRect(0, 0, width, height);

    const render = (pts: MaskParticle[], ox: number, color: string) => {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      pts.forEach((p, i) => {
        // A small seeded breathing motion, purely a function of (index, frame).
        const wob = Math.sin(frame * 0.05 + i * 0.7) * 2.2;
        const bright = Math.max(0.25, 1 - p.edgeDistance / 26);
        ctx.globalAlpha = 0.30 + bright * 0.6;
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(ox + p.x + wob, 230 + p.y + wob * 0.6, 1.5 + bright * 1.5, 0, Math.PI * 2);
        ctx.fill();
      });
      ctx.restore();
    };

    render(uniform, 100, THEME.rose);
    render(edged, 1020, THEME.cyan);

    ctx.font = '20px ui-monospace, monospace';
    ctx.fillStyle = THEME.text;
    ctx.textAlign = 'center';
    ctx.fillText('edgeBias 0 — a filled blob', 500, 960);
    ctx.fillText('edgeBias 0.8 — the form stays readable', 1420, 960);
  }, [uniform, edged]);

  return (
    <AbsoluteFill style={{ backgroundColor: THEME.bg }}>
      <Canvas draw={draw} />
      <Label title="generators/particleFromMask" note="Rejection sampling against a raster, weighted by a chamfer distance field." />
    </AbsoluteFill>
  );
};
