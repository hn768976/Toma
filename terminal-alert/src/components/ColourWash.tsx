import {useLayoutEffect} from 'react';
import {HEIGHT, WIDTH} from '../lib/constants';
import {ctx2d, lerp, randRange} from '../lib/draw';
import type {Stage} from '../stage';

/**
 * Layer 2 — a near-opaque flood of the variant's dominant hue. The text below
 * survives only as slightly darker and lighter striations. Opacity and
 * saturation both ride the instability curve, and the pre-built texture carries
 * the CRT banding, the upper-third lift and the vertical streaks.
 */
export const ColourWash: React.FC<{stage: Stage}> = ({stage}) => {
  useLayoutEffect(() => {
    const canvas = stage.canvasRef.current;
    if (!canvas || !stage.ready) return;
    const ctx = ctx2d(canvas);
    const {palette} = stage.cfg;

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = 'source-over';
    ctx.filter = 'none';
    ctx.shadowBlur = 0;

    // Recolour the whole frame to the dominant hue while keeping the text
    // layer's luminance. This is what lets the page survive as striations: a
    // straight alpha flood at this opacity would crush it out of existence.
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'color';
    ctx.fillStyle = palette.washMain;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    // Then the flood itself, which decides how much of the page is left legible.
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = stage.washAlpha;
    ctx.fillStyle = palette.washMain;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    if (stage.cfg.glitch.deepen > 0) {
      ctx.globalAlpha = stage.cfg.glitch.deepen;
      ctx.fillStyle = palette.washDeep;
      ctx.fillRect(0, 0, WIDTH, HEIGHT);
    }

    // Striations drift downward against the upward text scroll. One full frame
    // height over exactly 300 frames, so the drift is loop-closed too.
    const drift = -(stage.f / 300) * HEIGHT;
    const shimmer = Math.round(randRange(-2, 2, `${stage.cfg.name}-shim-${stage.f}`) * stage.instability);
    ctx.globalAlpha = stage.striation;
    ctx.drawImage(stage.washTexture, 0, drift + shimmer);
    ctx.drawImage(stage.washTexture, 0, drift + shimmer + HEIGHT);

    // More unstable, more saturated.
    const boost = lerp(0, 0.1, stage.instability);
    if (boost > 0.001) {
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = boost;
      ctx.fillStyle = palette.washMain;
      ctx.fillRect(0, 0, WIDTH, HEIGHT);
    }

    // The closing confirmation beat: the whole frame lifts and returns.
    if (stage.pulse > 0.001) {
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.15 * stage.pulse;
      ctx.fillStyle = palette.washMain;
      ctx.fillRect(0, 0, WIDTH, HEIGHT);
    }

    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
  });

  return null;
};
