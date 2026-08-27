import React, {useLayoutEffect, useMemo, useRef} from 'react';
import {AbsoluteFill} from 'remotion';
import {BackgroundLayer} from './components/BackgroundLayer';
import {GridOverlay} from './components/GridOverlay';
import {SubjectParticles} from './components/SubjectParticles';
import {drawGrain, drawVignette} from './lib/finish';
import {getScene} from './lib/scene';
import {CANVAS_H, CANVAS_W, MASK_TO_CANVAS} from './lib/space';
import {breathScale, useLoopFrame} from './lib/timing';
import {VARIANTS, type VariantName} from './variants';

export type ParticleFigureProps = {
  variant: VariantName;
};

/**
 * One 4K canvas, drawn in layers. Each layer is its own component and paints in
 * a layout effect; React flushes child layout effects in tree order and before
 * the parent's, so background -> grid -> particles -> finish is guaranteed
 * without any manual sequencing.
 */
export const ParticleFigure: React.FC<ParticleFigureProps> = ({variant}) => {
  const frame = useLoopFrame();
  const spec = VARIANTS[variant];
  const scene = useMemo(() => getScene(variant), [variant]);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const scale = breathScale(frame);
  const {x0, x1, y0, y1} = scene.field.bbox;
  const cx = ((x0 + x1) / 2) * MASK_TO_CANVAS;
  const cy = ((y0 + y1) / 2) * MASK_TO_CANVAS;
  const transform = useMemo(() => ({scale, cx, cy}), [scale, cx, cy]);

  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    drawVignette(ctx);
    drawGrain(ctx, frame);
  }, [frame]);

  return (
    <AbsoluteFill style={{backgroundColor: spec.palette.bgDeep}}>
      <canvas
        ref={canvasRef}
        width={CANVAS_W}
        height={CANVAS_H}
        style={{width: '100%', height: '100%', display: 'block'}}
      />
      <BackgroundLayer
        canvasRef={canvasRef}
        palette={spec.palette}
        mode={spec.background}
        seed={variant}
      />
      <GridOverlay
        canvasRef={canvasRef}
        grid={scene.grid}
        palette={spec.palette}
        transform={transform}
      />
      <SubjectParticles
        canvasRef={canvasRef}
        particles={scene.particles}
        palette={spec.palette}
        mode={spec.subject}
        transform={transform}
      />
    </AbsoluteFill>
  );
};
