import React, {useLayoutEffect} from 'react';
import {rgba} from '../lib/color';
import type {Scene} from '../lib/scene';
import {MASK_TO_CANVAS} from '../lib/space';
import {presence, useLoopFrame} from '../lib/timing';
import type {Palette} from '../variants';

type Props = {
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  scene: Scene;
  palette: Palette;
  /** Scale/translate the figure currently sits under. */
  transform: {scale: number; cx: number; cy: number};
};

const strokeSegments = (
  ctx: CanvasRenderingContext2D,
  segs: Float32Array,
  color: string,
  alpha: number,
  width: number,
) => {
  if (alpha <= 0.001) return;
  ctx.strokeStyle = rgba(color, alpha);
  ctx.lineWidth = width;
  ctx.beginPath();
  for (let i = 0; i < segs.length; i += 4) {
    ctx.moveTo(segs[i] * MASK_TO_CANVAS, segs[i + 1] * MASK_TO_CANVAS);
    ctx.lineTo(segs[i + 2] * MASK_TO_CANVAS, segs[i + 3] * MASK_TO_CANVAS);
  }
  ctx.stroke();
};

/**
 * The visible half of the grid technique: the same distorted lattice the
 * particles are snapped onto, drawn faintly so the wrap over the form reads.
 */
export const GridOverlay: React.FC<Props> = ({canvasRef, scene, palette, transform}) => {
  const frame = useLoopFrame();

  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const env = presence(frame, 0.5);
    if (env <= 0.001) return;

    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = 'lighter';
    ctx.translate(transform.cx, transform.cy);
    ctx.scale(transform.scale, transform.scale);
    ctx.translate(-transform.cx, -transform.cy);
    ctx.lineCap = 'butt';

    strokeSegments(ctx, scene.grid.vertical, palette.primary, 0.075 * env, 1.7);
    strokeSegments(ctx, scene.grid.horizontal, palette.secondary, 0.05 * env, 1.5);

    ctx.restore();
  }, [canvasRef, scene, palette, transform, frame]);

  return null;
};
