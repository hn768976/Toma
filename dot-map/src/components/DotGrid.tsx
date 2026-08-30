import React, {useLayoutEffect, useMemo, useRef} from 'react';
import {useCurrentFrame, useVideoConfig} from 'remotion';
import {LOOP_FRAMES} from '../constants';
import {RectBatch, context2d, makeCanvas} from '../lib/canvas';
import {hexToRgb} from '../lib/color';
import type {Rgb} from '../lib/color';
import {COLOR_HOT, DOT_SIZE} from '../lib/dots';
import type {DotField} from '../lib/dots';
import {
  buildFlashSchedule,
  drift,
  regionEnvelope,
  regionLocalTime,
  shimmer,
  sweepExcitation,
} from '../lib/motion';
import {buildRegionMembership} from '../lib/regions';
import type {VariantConfig} from '../variants';

/** The bloom is low-frequency, so it is built at a fraction of the frame. */
const BLOOM_SCALE = 0.25;

/**
 * The land dots: a baked static field blitted at the drift offset, with only
 * the per-frame brightness modulation drawn on top of it.
 */
export const DotGrid: React.FC<{field: DotField; config: VariantConfig}> = ({
  field,
  config,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const frame = useCurrentFrame();
  const {width, height, fps} = useVideoConfig();

  const colors = useMemo<Rgb[]>(
    () => [
      hexToRgb(config.palette.landDot),
      hexToRgb(config.palette.landBright),
      hexToRgb(config.palette.landCoastal),
      hexToRgb(config.palette.hot),
    ],
    [config],
  );

  /**
   * The field baked at the floor of its ambient swing. Everything drawn on top
   * of it each frame is additive, which keeps the modulation a single pass.
   */
  const staticLayer = useMemo(() => {
    const canvas = makeCanvas(field.layer.width, field.layer.height);
    const ctx = context2d(canvas);
    const batch = new RectBatch();
    const floor = 1 - config.ambient.amplitude;
    const half = DOT_SIZE / 2;
    for (let i = 0; i < field.n; i++) {
      batch.add(
        field.colorIndex[i],
        field.bright[i] * floor,
        field.x[i] - field.layer.originX + DOT_SIZE - half,
        field.y[i] - field.layer.originY + DOT_SIZE - half,
        DOT_SIZE,
      );
    }
    batch.flush(ctx, colors);
    return canvas;
  }, [field, config, colors]);

  const bloomLayers = useMemo(() => {
    const w = Math.round(width * BLOOM_SCALE);
    const h = Math.round(height * BLOOM_SCALE);
    return {source: makeCanvas(w, h), blurred: makeCanvas(w, h), w, h};
  }, [width, height]);

  const flashes = useMemo(
    () => buildFlashSchedule(field, config, LOOP_FRAMES, fps),
    [field, config, fps],
  );

  const regions = useMemo(
    () =>
      config.motion === 'hotspot'
        ? buildRegionMembership(field, config.hotspot)
        : null,
    [field, config],
  );

  const excitation = useMemo(() => new Float32Array(field.n), [field]);

  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }
    const ctx = context2d(canvas);
    ctx.clearRect(0, 0, width, height);

    const {dx, dy} = drift(frame, config.drift.amplitude, LOOP_FRAMES);
    ctx.drawImage(
      staticLayer,
      field.layer.originX - DOT_SIZE + dx,
      field.layer.originY - DOT_SIZE + dy,
    );

    /* Excitation — whatever is pushing dots above their ambient level. */
    excitation.fill(0);
    if (config.motion === 'sweep') {
      for (let i = 0; i < field.n; i++) {
        excitation[i] =
          sweepExcitation(field.y[i], frame, height, config, LOOP_FRAMES) *
          config.sweep.strength;
      }
    } else if (config.motion === 'hotspot' && regions) {
      for (let r = 0; r < regions.length; r++) {
        const localTime = regionLocalTime(
          r,
          frame,
          config.hotspot,
          LOOP_FRAMES,
        );
        const membership = regions[r];
        for (let k = 0; k < membership.dots.length; k++) {
          const env = regionEnvelope(
            localTime,
            membership.fraction[k],
            config.hotspot,
          );
          if (env > 0) {
            const dot = membership.dots[k];
            const value = env * config.hotspot.strength;
            if (value > excitation[dot]) {
              excitation[dot] = value;
            }
          }
        }
      }
    }
    for (const flash of flashes[frame % LOOP_FRAMES]) {
      if (flash.strength > excitation[flash.dot]) {
        excitation[flash.dot] = flash.strength;
      }
    }

    /* One additive pass carries both the ambient swing and the excitation. */
    const batch = new RectBatch();
    const bloomBatch = new RectBatch();
    const floor = 1 - config.ambient.amplitude;
    const half = DOT_SIZE / 2;
    const bloomHalf = (DOT_SIZE * BLOOM_SCALE) / 2;
    for (let i = 0; i < field.n; i++) {
      const level = shimmer(field, i, frame, config.ambient.amplitude);
      const base = field.bright[i];
      const x = field.x[i] + dx - half;
      const y = field.y[i] + dy - half;
      batch.add(field.colorIndex[i], base * (level - floor), x, y, DOT_SIZE);
      const excited = excitation[i];
      if (excited > 0) {
        batch.add(COLOR_HOT, excited, x, y, DOT_SIZE);
      }
      // Bloom on the brightest dots only.
      const total = base * level + excited;
      if (total > config.finish.bloomThreshold) {
        bloomBatch.add(
          excited > 0 ? COLOR_HOT : field.colorIndex[i],
          Math.min(1, total - config.finish.bloomThreshold),
          (field.x[i] + dx) * BLOOM_SCALE - bloomHalf,
          (field.y[i] + dy) * BLOOM_SCALE - bloomHalf,
          DOT_SIZE * BLOOM_SCALE,
        );
      }
    }

    ctx.globalCompositeOperation = 'lighter';
    batch.flush(ctx, colors);

    const source = context2d(bloomLayers.source);
    source.clearRect(0, 0, bloomLayers.w, bloomLayers.h);
    source.globalCompositeOperation = 'lighter';
    bloomBatch.flush(source, colors);
    source.globalCompositeOperation = 'source-over';

    // Blurring in the small buffer and scaling up is far cheaper than a 4K
    // blur, and a bloom has no detail to lose.
    const blurred = context2d(bloomLayers.blurred);
    blurred.clearRect(0, 0, bloomLayers.w, bloomLayers.h);
    blurred.filter = `blur(${config.finish.bloomBlur}px)`;
    blurred.drawImage(bloomLayers.source, 0, 0);
    blurred.filter = 'none';

    ctx.globalAlpha = config.finish.bloomAlpha;
    ctx.drawImage(bloomLayers.blurred, 0, 0, width, height);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }, [
    frame,
    width,
    height,
    config,
    field,
    colors,
    staticLayer,
    bloomLayers,
    flashes,
    regions,
    excitation,
  ]);

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      style={{position: 'absolute', inset: 0, width: '100%', height: '100%'}}
    />
  );
};
