import React, {useLayoutEffect, useRef} from 'react';
import {
  AbsoluteFill,
  getRemotionEnvironment,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import {DURATION, VERSIONS, WIDTH} from './config';
import {drawDust} from './draw/dust';
import {applyFringe} from './draw/fringe';
import {drawGate} from './draw/gate';
import {drawHairs} from './draw/hairs';
import {drawScratches} from './draw/scratches';
import {flickerLevel, weaveOffset} from './draw/flicker';
import type {DrawCtx} from './draw/types';
import {wrap} from './rand';

export type FilmTextureProps = {
  version: keyof typeof VERSIONS;
};

/**
 * `--scale` reaches the page as the device pixel ratio, so sizing the canvas
 * backing store by it means artifacts are generated at the *output* resolution
 * rather than rendered at 4K and resampled down into grey mush.
 */
const backingScale = (): number => {
  const dpr = typeof window === 'undefined' ? 1 : window.devicePixelRatio || 1;
  if (getRemotionEnvironment().isRendering) {
    return dpr;
  }
  // In the Studio / Player, a retina DPR would mean an 8K backing store for a
  // preview nobody is exporting.
  return Math.min(dpr, 1);
};

export const FilmTexture: React.FC<FilmTextureProps> = ({version}) => {
  const frame = useCurrentFrame();
  const {width, height} = useVideoConfig();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const v = VERSIONS[version];

  // Painted synchronously in a layout effect so the frame is complete before
  // Remotion captures it.
  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }
    const dpr = backingScale();
    const w = Math.max(1, Math.round(width * dpr));
    const h = Math.max(1, Math.round(height * dpr));
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }

    const ctx = canvas.getContext('2d', {alpha: false});
    if (!ctx) {
      return;
    }

    const d: DrawCtx = {
      ctx,
      w,
      h,
      // Design space is always 4K, whatever the output resolution is.
      s: w / WIDTH,
      frame: wrap(frame, DURATION),
      v,
    };

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
    ctx.filter = 'none';

    // The field itself. Pure white wherever there is no artifact, so under a
    // multiply blend the footage below is left completely untouched.
    const level = Math.round(255 * flickerLevel(v, d.frame));
    ctx.fillStyle = `rgb(${level},${level},${level})`;
    ctx.fillRect(0, 0, w, h);

    // Weave: the whole plate walks sideways a pixel or two, as film does
    // through a gate. The white base above is drawn full-bleed first so the
    // shift can never expose an edge.
    const weave = weaveOffset(v, d.frame);
    ctx.translate(weave, 0);

    drawScratches(d);
    drawDust(d);
    drawHairs(d);

    // Fringing is applied to the artifacts before the gate goes down: letting
    // it split the gate's own edge produces an obvious coloured band, and this
    // is meant to be invisible until looked for.
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    applyFringe(d);

    ctx.translate(weave, 0);
    drawGate(d);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }, [frame, width, height, v]);

  return (
    <AbsoluteFill style={{backgroundColor: '#ffffff'}}>
      <canvas
        ref={canvasRef}
        style={{width: '100%', height: '100%', display: 'block'}}
      />
    </AbsoluteFill>
  );
};
