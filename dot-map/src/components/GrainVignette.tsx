import React, {useLayoutEffect, useMemo, useRef} from 'react';
import {random, useCurrentFrame, useVideoConfig} from 'remotion';
import {LOOP_FRAMES} from '../constants';
import {context2d, makeCanvas} from '../lib/canvas';
import {hexToRgb, rgba} from '../lib/color';
import type {VariantConfig} from '../variants';

const TILE = 256;
/** Enough tiles that the grain never repeats visibly frame to frame. */
const TILE_COUNT = 4;

/**
 * Vignette and grain. The grain is seeded tiles chosen and offset by frame, so
 * it is different every frame, identical on every render, and periodic across
 * the loop.
 */
export const GrainVignette: React.FC<{config: VariantConfig}> = ({config}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const frame = useCurrentFrame();
  const {width, height} = useVideoConfig();

  const tiles = useMemo(() => {
    const grain = hexToRgb(config.palette.grain);
    return Array.from({length: TILE_COUNT}, (_unused, t) => {
      const canvas = makeCanvas(TILE, TILE);
      const ctx = context2d(canvas);
      const image = ctx.createImageData(TILE, TILE);
      for (let i = 0; i < TILE * TILE; i++) {
        const v = random(`grain-${t}-${i}`);
        image.data[i * 4] = grain[0];
        image.data[i * 4 + 1] = grain[1];
        image.data[i * 4 + 2] = grain[2];
        // Skewed so most pixels contribute nothing — grain, not a haze.
        image.data[i * 4 + 3] = Math.round(Math.pow(v, 2.2) * 255);
      }
      ctx.putImageData(image, 0, 0);
      return canvas;
    });
  }, [config]);

  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }
    const ctx = context2d(canvas);
    ctx.clearRect(0, 0, width, height);

    const shadow = hexToRgb(config.palette.shadow);
    const cx = width / 2;
    const cy = height / 2;
    const outer = Math.hypot(cx, cy);
    const vignette = ctx.createRadialGradient(cx, cy, outer * 0.42, cx, cy, outer);
    vignette.addColorStop(0, rgba(shadow, 0));
    vignette.addColorStop(0.7, rgba(shadow, config.finish.vignette * 0.4));
    vignette.addColorStop(1, rgba(shadow, config.finish.vignette));
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, width, height);

    const loopFrame = frame % LOOP_FRAMES;
    const pattern = ctx.createPattern(tiles[loopFrame % TILE_COUNT], 'repeat');
    if (pattern) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = config.finish.grainAlpha;
      ctx.translate(
        -Math.floor(random(`grain-x-${loopFrame}`) * TILE),
        -Math.floor(random(`grain-y-${loopFrame}`) * TILE),
      );
      ctx.fillStyle = pattern;
      ctx.fillRect(0, 0, width + TILE, height + TILE);
      ctx.restore();
    }
  }, [frame, width, height, config, tiles]);

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      style={{position: 'absolute', inset: 0, width: '100%', height: '100%'}}
    />
  );
};
