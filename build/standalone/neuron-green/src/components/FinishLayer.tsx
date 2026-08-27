import React, {useEffect, useMemo, useRef} from 'react';
import {random} from 'remotion';
import {DUR} from '../motion';

const TILE = 512;

/** Vignette (~20%) plus fine seeded grain at ~4% alpha, looping on frame % 375. */
export const FinishLayer: React.FC<{
  frame: number;
  width: number;
  height: number;
}> = ({frame, width, height}) => {
  const ref = useRef<HTMLCanvasElement>(null);

  const grainTile = useMemo(() => {
    const c = document.createElement('canvas');
    c.width = TILE;
    c.height = TILE;
    const ctx = c.getContext('2d');
    if (ctx) {
      const img = ctx.createImageData(TILE, TILE);
      for (let i = 0; i < TILE * TILE; i++) {
        const v = Math.floor(random(`grain-${i}`) * 256);
        img.data[i * 4] = v;
        img.data[i * 4 + 1] = v;
        img.data[i * 4 + 2] = v;
        img.data[i * 4 + 3] = 255;
      }
      ctx.putImageData(img, 0, 0);
    }
    return c;
  }, []);

  useEffect(() => {
    const ctx = ref.current?.getContext('2d');
    if (!ctx) {
      return;
    }
    ctx.clearRect(0, 0, width, height);

    // Vignette
    const cx = width / 2;
    const cy = height / 2;
    const rMax = Math.hypot(cx, cy);
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, rMax);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(0.55, 'rgba(0,0,0,0)');
    g.addColorStop(1, 'rgba(0,0,0,0.34)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, width, height);

    // Grain, offset seeded on frame % 375 so the loop closes exactly
    const key = frame % DUR;
    const ox = Math.floor(random(`grain-ox-${key}`) * TILE);
    const oy = Math.floor(random(`grain-oy-${key}`) * TILE);
    ctx.globalAlpha = 0.04;
    for (let y = -oy; y < height; y += TILE) {
      for (let x = -ox; x < width; x += TILE) {
        ctx.drawImage(grainTile, x, y);
      }
    }
    ctx.globalAlpha = 1;
  }, [frame, width, height, grainTile]);

  return (
    <canvas
      ref={ref}
      width={width}
      height={height}
      style={{position: 'absolute', top: 0, left: 0, width: '100%', height: '100%'}}
    />
  );
};
