import React, {useLayoutEffect, useMemo, useRef} from 'react';
import {AbsoluteFill, useCurrentFrame, useVideoConfig} from 'remotion';
import {VARIANTS} from './variants';
import type {VariantId} from './variants';
import {Backdrop} from './components/Backdrop';
import {BandLayer} from './components/BandLayer';
import {BeamLayer} from './components/BeamLayer';
import {CentreLabel} from './components/CentreLabel';
import {ParticleWash} from './components/ParticleWash';
import {activeGlitch, cameraDrift, glitchSchedule} from './lib/motion';
import {
  applyGlitchSlices,
  applyGrain,
  applyHighlightLift,
  applyVignette,
  compositeWithBloom,
  paintGround,
} from './lib/postfx';
import {context2d, makeCanvas} from './lib/util';

export type AgenticHudProps = {
  variant: VariantId;
};

/**
 * Each layer owns an offscreen canvas and paints it in its own layout effect.
 * React runs child effects before the parent's, so by the time this component's
 * effect runs every layer is finished and can be composited in order.
 */
export const AgenticHud: React.FC<AgenticHudProps> = ({variant}) => {
  const frame = useCurrentFrame();
  const {width, height, durationInFrames} = useVideoConfig();
  const v = VARIANTS[variant];

  const mainRef = useRef<HTMLCanvasElement>(null);

  const buffers = useMemo(
    () => ({
      backdrop: makeCanvas(width, height),
      bands: makeCanvas(width, height),
      beam: makeCanvas(width, height),
      label: makeCanvas(width, height),
      particles: makeCanvas(width, height),
      // Bloom is blurred at quarter resolution: cheaper and softer at 4K.
      small: makeCanvas(Math.round(width / 4), Math.round(height / 4)),
      full: makeCanvas(width, height),
    }),
    [width, height]
  );

  const cx = width / 2;
  const cy = height / 2;
  const R = height * v.scale;

  const glitchEvents = useMemo(
    () => (v.glitch ? glitchSchedule(v.glitch, durationInFrames) : []),
    [v.glitch, durationInFrames]
  );
  const glitch = v.glitch ? activeGlitch(glitchEvents, frame) : null;

  const layerProps = {
    variant: v,
    frame,
    durationInFrames,
    cx,
    cy,
    R,
  };

  useLayoutEffect(() => {
    const canvas = mainRef.current;
    if (!canvas) return;
    const ctx = context2d(canvas);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    ctx.filter = 'none';

    paintGround(ctx, v.post, v.palette.bgDeep, v.palette.bgMid, cx, cy, R * 2.6);

    const drift = cameraDrift(frame, durationInFrames, v.cameraDrift);
    const scratch = {small: buffers.small, full: buffers.full};

    ctx.save();
    ctx.translate(drift.x, drift.y);
    compositeWithBloom(ctx, buffers.backdrop, [], scratch);
    compositeWithBloom(ctx, buffers.bands, v.post.bloom, scratch);
    compositeWithBloom(ctx, buffers.beam, v.post.bloom, scratch);
    compositeWithBloom(ctx, buffers.label, v.post.labelBloom, scratch);
    compositeWithBloom(ctx, buffers.particles, [], scratch);
    ctx.restore();

    applyHighlightLift(ctx, v.post.highlightLift, scratch);

    if (glitch && v.glitch) {
      applyGlitchSlices(ctx, v.glitch, glitch.index, scratch);
    }

    applyVignette(ctx, v.post.vignette, v.post.vignetteInvert);
    applyGrain(ctx, v.post.grain, frame);
  });

  return (
    <AbsoluteFill style={{backgroundColor: v.palette.bgDeep}}>
      <canvas
        ref={mainRef}
        width={width}
        height={height}
        style={{width: '100%', height: '100%', display: 'block'}}
      />
      <Backdrop canvas={buffers.backdrop} {...layerProps} />
      <BandLayer canvas={buffers.bands} {...layerProps} />
      <BeamLayer canvas={buffers.beam} {...layerProps} />
      <CentreLabel
        canvas={buffers.label}
        {...layerProps}
        channelSplit={glitch && v.glitch ? v.glitch.channelSplit : 0}
        channelWarm={v.glitch?.channelWarm ?? v.palette.labelA}
        channelCool={v.glitch?.channelCool ?? v.palette.labelB}
      />
      <ParticleWash canvas={buffers.particles} {...layerProps} />
    </AbsoluteFill>
  );
};
