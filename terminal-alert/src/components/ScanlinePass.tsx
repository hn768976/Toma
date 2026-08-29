import {useLayoutEffect} from 'react';
import {random} from 'remotion';
import {HEIGHT, WIDTH} from '../lib/constants';
import {ctx2d, withAlpha} from '../lib/draw';
import type {Stage} from '../stage';

/**
 * The finish: scanlines, vignette and grain, applied over everything including
 * the tears so the degradation sits in the same signal as the picture.
 */
export const ScanlinePass: React.FC<{stage: Stage}> = ({stage}) => {
  useLayoutEffect(() => {
    const canvas = stage.canvasRef.current;
    if (!canvas || !stage.ready) return;
    const ctx = ctx2d(canvas);
    const {palette} = stage.cfg;

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
    ctx.filter = 'none';
    ctx.shadowBlur = 0;

    const scan = ctx.createPattern(stage.scanlineTile, 'repeat');
    if (scan) {
      ctx.fillStyle = scan;
      ctx.fillRect(0, 0, WIDTH, HEIGHT);
    }

    const vignette = ctx.createRadialGradient(
      WIDTH / 2,
      HEIGHT / 2,
      HEIGHT * 0.25,
      WIDTH / 2,
      HEIGHT / 2,
      WIDTH * 0.72,
    );
    vignette.addColorStop(0, withAlpha(palette.bannerBlack, 0));
    vignette.addColorStop(0.62, withAlpha(palette.bannerBlack, 0.05));
    vignette.addColorStop(1, withAlpha(palette.bannerBlack, 0.3));
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    // Heavier grain than usual — it suits a degraded signal. Seeded on frame % 300
    // so the noise field is identical at the loop point.
    const tile = stage.grainTiles[Math.floor(random(`grain-pick-${stage.f}`) * stage.grainTiles.length)];
    const pattern = ctx.createPattern(tile, 'repeat');
    if (pattern) {
      const ox = Math.floor(random(`grain-ox-${stage.f}`) * tile.width);
      const oy = Math.floor(random(`grain-oy-${stage.f}`) * tile.height);
      ctx.save();
      ctx.globalAlpha = 0.05;
      ctx.translate(ox, oy);
      ctx.fillStyle = pattern;
      ctx.fillRect(-ox, -oy, WIDTH, HEIGHT);
      ctx.restore();
    }

    ctx.globalAlpha = 1;
  });

  return null;
};
