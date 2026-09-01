/** taperedStroke + drawOn. */
import React, { useCallback } from 'react';
import { AbsoluteFill } from 'remotion';
import { taperedStroke, applyDrawOn, polylineLength } from '../../../src/strokes';
import { Canvas, type DrawFn } from '../Canvas';
import { Label } from '../Label';
import { THEME } from '../theme';

const arc = (cx: number, cy: number, r: number, from: number, to: number, n = 160) =>
  Array.from({ length: n + 1 }, (_, i) => {
    const a = from + ((to - from) * i) / n;
    return { x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r };
  });

export const StrokesDemo: React.FC = () => {
  const draw: DrawFn = useCallback((ctx, frame, width, height) => {
    ctx.fillStyle = THEME.bg;
    ctx.fillRect(0, 0, width, height);

    const spin = frame * 0.035;

    // Tapered comet trails.
    for (let k = 0; k < 3; k++) {
      const pts = arc(560, 440, 200 - k * 46, spin + k * 1.9, spin + k * 1.9 + 2.4);
      taperedStroke({
        ctx, points: pts,
        color: [THEME.cyan, THEME.accent, THEME.rose][k],
        startWidth: 16 - k * 3,
        endWidth: 0,
        easing: (t) => t * t,
        additive: true,
      });
    }

    // Draw-on: a path revealing itself along its own length.
    const path = arc(1400, 440, 210, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2);
    const len = polylineLength(path);
    const progress = (frame % 90) / 90;
    ctx.save();
    ctx.strokeStyle = THEME.green;
    ctx.lineWidth = 7;
    ctx.lineCap = 'round';
    applyDrawOn(ctx, { length: len, progress });
    ctx.beginPath();
    ctx.moveTo(path[0].x, path[0].y);
    for (const p of path.slice(1)) ctx.lineTo(p.x, p.y);
    ctx.stroke();
    ctx.restore();

    ctx.font = '20px ui-monospace, monospace';
    ctx.fillStyle = THEME.text;
    ctx.textAlign = 'center';
    ctx.fillText('taperedStroke — width + alpha falloff', 560, 760);
    ctx.fillText('drawOn — dash offset', 1400, 760);
  }, []);

  return (
    <AbsoluteFill style={{ backgroundColor: THEME.bg }}>
      <Canvas draw={draw} />
      <Label title="strokes/taperedStroke + drawOn" note="Canvas has no variable-width stroke; segments give you one." />
    </AbsoluteFill>
  );
};
