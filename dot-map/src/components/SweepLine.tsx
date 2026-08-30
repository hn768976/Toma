import React, {useLayoutEffect, useRef} from 'react';
import {useCurrentFrame, useVideoConfig} from 'remotion';
import {LOOP_FRAMES} from '../constants';
import {context2d} from '../lib/canvas';
import {hexToRgb, rgba} from '../lib/color';
import {sweepLineY, sweepPercent} from '../lib/motion';
import type {VariantConfig} from '../variants';

/**
 * The scan line itself: a thin bright core with a soft glow above and below,
 * travelling top to bottom. The trail behind it lives in the dots — this
 * component only draws the line and the readout that names what it is doing.
 */
export const SweepLine: React.FC<{config: VariantConfig}> = ({config}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const frame = useCurrentFrame();
  const {width, height} = useVideoConfig();

  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }
    const ctx = context2d(canvas);
    ctx.clearRect(0, 0, width, height);

    const hot = hexToRgb(config.palette.hot);
    const y = sweepLineY(frame, height, config.sweep.passes, LOOP_FRAMES);
    const glow = config.sweep.glowHalfHeight;

    ctx.globalCompositeOperation = 'lighter';

    const gradient = ctx.createLinearGradient(0, y - glow, 0, y + glow);
    gradient.addColorStop(0, rgba(hot, 0));
    gradient.addColorStop(0.35, rgba(hot, config.sweep.glowAlpha * 0.45));
    gradient.addColorStop(0.5, rgba(hot, config.sweep.glowAlpha));
    gradient.addColorStop(0.65, rgba(hot, config.sweep.glowAlpha * 0.45));
    gradient.addColorStop(1, rgba(hot, 0));
    ctx.fillStyle = gradient;
    ctx.fillRect(0, y - glow, width, glow * 2);

    ctx.fillStyle = rgba(hot, 0.95);
    ctx.fillRect(
      0,
      y - config.sweep.coreHalfHeight,
      width,
      config.sweep.coreHalfHeight * 2,
    );

    ctx.globalCompositeOperation = 'source-over';

    if (config.sweep.readout) {
      const percent = sweepPercent(frame, config.sweep.passes, LOOP_FRAMES);
      ctx.font = `${config.sweep.readoutSize}px ui-monospace, "SF Mono", Menlo, Consolas, "Liberation Mono", "DejaVu Sans Mono", monospace`;
      ctx.textAlign = 'right';
      ctx.textBaseline = 'alphabetic';
      ctx.fillStyle = rgba(
        hexToRgb(config.palette.readout),
        config.sweep.readoutAlpha,
      );
      ctx.fillText(
        `${String(percent).padStart(2, '0')}%`,
        width - config.sweep.readoutMargin,
        height - config.sweep.readoutMargin,
      );
    }
  }, [frame, width, height, config]);

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      style={{position: 'absolute', inset: 0, width: '100%', height: '100%'}}
    />
  );
};
