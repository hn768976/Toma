import React, {useEffect, useRef} from 'react';
import type {VariantConfig} from '../variants';
import {rgba} from '../color';

/**
 * Deep base colour with a broad soft radial wash behind the node cluster,
 * falling to near-black at the far corners. Static - drawn once per tab.
 */
export const BackgroundWash: React.FC<{
  cfg: VariantConfig;
  width: number;
  height: number;
}> = ({cfg, width, height}) => {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const ctx = ref.current?.getContext('2d');
    if (!ctx) {
      return;
    }
    const {palette, wash} = cfg;
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = palette.bgDeep;
    ctx.fillRect(0, 0, width, height);

    const cx = wash.x * width;
    const cy = wash.y * height;
    const radius = wash.radius * width;
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
    g.addColorStop(0, rgba(palette.bgWash, 0.9));
    g.addColorStop(0.55, rgba(palette.bgWash, 0.38));
    g.addColorStop(1, rgba(palette.bgWash, 0));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, width, height);
  }, [cfg, width, height]);

  return (
    <canvas
      ref={ref}
      width={width}
      height={height}
      style={{position: 'absolute', top: 0, left: 0, width: '100%', height: '100%'}}
    />
  );
};
