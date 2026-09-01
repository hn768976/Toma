/** neonStroke: four-pass construction vs a single thick stroke, side by side. */
import React, { useCallback } from 'react';
import { AbsoluteFill } from 'remotion';
import { neonStroke, neonFill } from '../../../src/strokes';
import { Canvas, type DrawFn } from '../Canvas';
import { Label } from '../Label';
import { THEME } from '../theme';

const wave = (ctx: CanvasRenderingContext2D, cx: number, frame: number) => {
  ctx.beginPath();
  for (let i = 0; i <= 120; i++) {
    const t = i / 120;
    const x = cx - 320 + t * 640;
    const y = 460 + Math.sin(t * Math.PI * 3 + frame * 0.06) * 120;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
};

export const NeonStrokeDemo: React.FC = () => {
  const draw: DrawFn = useCallback((ctx, frame, width, height) => {
    ctx.fillStyle = THEME.bg;
    ctx.fillRect(0, 0, width, height);

    // LEFT: the wrong answer — one thick semi-transparent stroke.
    ctx.save();
    ctx.strokeStyle = THEME.accent;
    ctx.globalAlpha = 0.5;
    ctx.lineWidth = 22;
    ctx.lineCap = 'round';
    wave(ctx, 520, frame);
    ctx.stroke();
    ctx.restore();

    // RIGHT: the four-pass construction.
    neonStroke({
      ctx,
      path: (c) => wave(c, 1400, frame),
      color: THEME.accent,
      coreColor: THEME.accentHot,
      width: 3.5,
      intensity: 0.85 + Math.sin(frame * 0.2) * 0.15,
    });

    neonFill({
      ctx, cx: 1400, cy: 760, radius: 7,
      color: THEME.cyan, coreColor: '#FFFFFF',
    });

    ctx.font = '22px ui-monospace, monospace';
    ctx.fillStyle = THEME.text;
    ctx.textAlign = 'center';
    ctx.fillText('one thick stroke @ 50%', 520, 880);
    ctx.fillText('neonStroke — 4 passes, lighter', 1400, 880);
  }, []);

  return (
    <AbsoluteFill style={{ backgroundColor: THEME.bg }}>
      <Canvas draw={draw} />
      <Label title="strokes/neonStroke" note="Wide glow, outer, channel, hot core — composited additively." />
    </AbsoluteFill>
  );
};
