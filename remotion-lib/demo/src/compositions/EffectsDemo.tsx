/** grainPass, vignettePass, bloomPass, lowResUpscale — applied in order. */
import React, { useCallback, useMemo } from 'react';
import { AbsoluteFill } from 'remotion';
import {
  buildGrainTiles, grainPass, vignettePass, bloomPass,
  createLowResLayer, clearLowResLayer, compositeLowRes, type LowResLayer,
} from '../../../src/effects';
import { neonStroke, neonFill } from '../../../src/strokes';
import { mulberry32, radialPlaces } from '../../../src/random';
import { Canvas, type DrawFn } from '../Canvas';
import { Label } from '../Label';
import { THEME, WIDTH, HEIGHT } from '../theme';

export const EffectsDemo: React.FC = () => {
  // Allocated once, cleared per frame — never per frame.
  const tiles = useMemo(() => buildGrainTiles({ seed: 3, size: 256, tileCount: 4 }), []);
  const scene = useMemo(() => {
    const c = document.createElement('canvas');
    c.width = WIDTH; c.height = HEIGHT; return c;
  }, []);
  const scratch = useMemo(() => document.createElement('canvas'), []);
  const haze: LowResLayer = useMemo(
    () => createLowResLayer({ width: WIDTH, height: HEIGHT, scale: 8 }), []);

  const draw: DrawFn = useCallback((ctx, frame, width, height) => {
    const sctx = scene.getContext('2d');
    if (!sctx) return;
    sctx.setTransform(1, 0, 0, 1, 0, 0);
    sctx.globalCompositeOperation = 'source-over';
    sctx.globalAlpha = 1;
    sctx.filter = 'none';
    sctx.clearRect(0, 0, width, height);
    sctx.fillStyle = THEME.bg;
    sctx.fillRect(0, 0, width, height);

    // A soft haze computed at 1/8 resolution — correct use: it is a gradient.
    clearLowResLayer(haze);
    const g = haze.ctx.createRadialGradient(width / 2, 460, 0, width / 2, 460, 620);
    g.addColorStop(0, 'rgba(46,107,255,0.55)');
    g.addColorStop(1, 'rgba(46,107,255,0)');
    haze.ctx.fillStyle = g;
    haze.ctx.fillRect(0, 0, width, height);
    compositeLowRes({ ctx: sctx, layer: haze, composite: 'lighter', opacity: 0.9 });

    // Bright content for the bloom to find.
    neonStroke({
      ctx: sctx,
      path: (c) => {
        c.beginPath();
        for (let i = 0; i <= 100; i++) {
          const t = i / 100;
          const x = 300 + t * 1320;
          const y = 460 + Math.sin(t * Math.PI * 2 + frame * 0.05) * 150;
          if (i === 0) c.moveTo(x, y); else c.lineTo(x, y);
        }
      },
      color: THEME.cyan, coreColor: '#FFFFFF', width: 3,
    });
    for (const p of radialPlaces({
      count: 14, cx: 960, cy: 460, radius: 330, rng: mulberry32(5),
    })) {
      neonFill({ ctx: sctx, cx: p.x, cy: p.y, radius: 4, color: THEME.amber, coreColor: '#FFF' });
    }

    ctx.drawImage(scene, 0, 0);
    bloomPass({ ctx, width, height, source: scene, scratch, threshold: 0.55, intensity: 0.9 });
    grainPass({ ctx, width, height, tiles, frame, opacity: 0.07 });
    vignettePass({ ctx, width, height, color: '#000000', strength: 0.6 });
  }, [scene, scratch, tiles, haze]);

  return (
    <AbsoluteFill style={{ backgroundColor: THEME.bg }}>
      <Canvas draw={draw} />
      <Label title="effects/ — lowResUpscale, bloomPass, grainPass, vignettePass" note="Haze at 1/8 res, then bloom, grain, and vignette last." />
    </AbsoluteFill>
  );
};
