import React, {useLayoutEffect, useMemo, useRef} from 'react';
import {useCurrentFrame, useVideoConfig} from 'remotion';
import {LOOP_FRAMES} from '../constants';
import {context2d, makeCanvas} from '../lib/canvas';
import {hexToRgb, mix, rgba} from '../lib/color';
import {DOT_SIZE} from '../lib/dots';
import type {DotField} from '../lib/dots';
import {drift} from '../lib/motion';
import type {VariantConfig} from '../variants';

/**
 * The deep base, the radial wash behind the map's centre, and the very faint
 * grid that covers the whole frame including ocean. That grid is what makes
 * the land read as lit cells in a panel rather than dots floating in space.
 */
export const BackgroundWash: React.FC<{
  field: DotField;
  config: VariantConfig;
}> = ({field, config}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const frame = useCurrentFrame();
  const {width, height} = useVideoConfig();

  // The full-frame grid is tens of thousands of squares and never changes, so
  // it is baked once and blitted at the drift offset every frame.
  const oceanLayer = useMemo(() => {
    const canvas = makeCanvas(field.layer.width, field.layer.height);
    const ctx = context2d(canvas);
    const color = hexToRgb(config.palette.oceanDot);
    ctx.fillStyle = rgba(color, config.background.oceanDotAlpha);
    const path = new Path2D();
    const half = DOT_SIZE / 2;
    for (let i = 0; i < field.gridX.length; i++) {
      path.rect(
        field.gridX[i] - field.layer.originX + DOT_SIZE - half,
        field.gridY[i] - field.layer.originY + DOT_SIZE - half,
        DOT_SIZE,
        DOT_SIZE,
      );
    }
    ctx.fill(path);
    return canvas;
  }, [field, config]);

  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }
    const ctx = context2d(canvas);
    ctx.clearRect(0, 0, width, height);

    const deep = hexToRgb(config.palette.deep);
    const shadow = hexToRgb(config.palette.shadow);
    const wash = hexToRgb(config.palette.wash);

    const vertical = ctx.createLinearGradient(0, 0, 0, height);
    vertical.addColorStop(0, rgba(mix(deep, shadow, 0.18), 1));
    vertical.addColorStop(0.42, rgba(deep, 1));
    vertical.addColorStop(1, rgba(mix(deep, shadow, config.background.gradientDepth), 1));
    ctx.fillStyle = vertical;
    ctx.fillRect(0, 0, width, height);

    const cx = width / 2;
    const cy = height / 2;
    const radius = width * config.background.washRadius;
    const radial = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
    radial.addColorStop(0, rgba(wash, config.background.washAlpha));
    radial.addColorStop(0.55, rgba(wash, config.background.washAlpha * 0.35));
    radial.addColorStop(1, rgba(wash, 0));
    ctx.fillStyle = radial;
    ctx.fillRect(0, 0, width, height);

    const {dx, dy} = drift(frame, config.drift.amplitude, LOOP_FRAMES);
    ctx.drawImage(
      oceanLayer,
      field.layer.originX - DOT_SIZE + dx,
      field.layer.originY - DOT_SIZE + dy,
    );
  }, [frame, width, height, config, field, oceanLayer]);

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      style={{position: 'absolute', inset: 0, width: '100%', height: '100%'}}
    />
  );
};
