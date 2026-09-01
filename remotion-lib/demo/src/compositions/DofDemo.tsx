/** threeBufferDOF: elements bucketed by depth, three blurs total. */
import React, { useCallback, useMemo } from 'react';
import { AbsoluteFill } from 'remotion';
import {
  createDofBuffers, clearDofBuffers, bufferFor, compositeDof,
} from '../../../src/effects';
import { mulberry32 } from '../../../src/random';
import { neonFill } from '../../../src/strokes';
import { Canvas, type DrawFn } from '../Canvas';
import { Label } from '../Label';
import { THEME, WIDTH, HEIGHT } from '../theme';

type Mote = { x: number; y: number; depth: number; r: number; speed: number };

export const DofDemo: React.FC = () => {
  const buffers = useMemo(
    () => createDofBuffers({ width: WIDTH, height: HEIGHT, blurPx: [26, 9, 0] }), []);

  const motes: Mote[] = useMemo(() => {
    const rng = mulberry32(42);
    return Array.from({ length: 220 }, () => {
      const depth = rng();
      return {
        x: rng() * WIDTH,
        y: 160 + rng() * (HEIGHT - 420),
        depth,
        // Near motes are larger — the other half of the depth cue.
        r: 3 + depth * 13,
        speed: 12 + depth * 46,
      };
    });
  }, []);

  const draw: DrawFn = useCallback((ctx, frame, width, height) => {
    ctx.fillStyle = THEME.bg;
    ctx.fillRect(0, 0, width, height);

    clearDofBuffers(buffers);
    const t = frame / 30;
    for (const m of motes) {
      const bctx = bufferFor(buffers, m.depth);
      const x = ((m.x + t * m.speed) % (width + 120)) - 60;
      neonFill({
        ctx: bctx, cx: x, cy: m.y, radius: m.r,
        color: m.depth > 0.66 ? THEME.cyan : m.depth > 0.33 ? THEME.accent : THEME.rose,
        coreColor: '#FFFFFF',
        intensity: 0.35 + m.depth * 0.65,
      });
    }
    compositeDof({ ctx, buffers, recede: 0.5, recedeColor: THEME.bg });

    ctx.font = '20px ui-monospace, monospace';
    ctx.fillStyle = THEME.text;
    ctx.fillText('220 elements · 3 blur operations · far → mid → near', 64, 980);
  }, [buffers, motes]);

  return (
    <AbsoluteFill style={{ backgroundColor: THEME.bg }}>
      <Canvas draw={draw} />
      <Label title="effects/threeBufferDOF" note="Bucket by depth, blur each buffer once. Per-element blur is unusable at 4K." />
    </AbsoluteFill>
  );
};
