import React, { useMemo } from "react";
import { useCanvasDraw } from "./canvas";
import { withAlpha } from "./postFx";
import { rand, randRange } from "./random";

/**
 * Sparse twinkling points across the frame — mostly dim, a scattering
 * brighter. Colour, count, sizing and twinkle rate are all props; pure
 * function of `frame`.
 */
export const StarField: React.FC<{
  frame: number;
  width: number;
  height: number;
  color: string;
  seed: string;
  count?: number;
  minRadius?: number;
  maxRadius?: number;
  /** Higher values push more stars toward the dim end. */
  brightnessBias?: number;
  minAlpha?: number;
  maxAlpha?: number;
  twinklePeriodMin?: number;
  twinklePeriodMax?: number;
  /** Fraction of brightness the twinkle swings, 0-1. */
  twinkleDepth?: number;
  style?: React.CSSProperties;
}> = ({
  frame,
  width,
  height,
  color,
  seed,
  count = 460,
  minRadius = 1.2,
  maxRadius = 3.4,
  brightnessBias = 2.4,
  minAlpha = 0.12,
  maxAlpha = 0.9,
  twinklePeriodMin = 110,
  twinklePeriodMax = 290,
  twinkleDepth = 0.28,
  style,
}) => {
  const stars = useMemo(() => {
    const list = [];
    for (let i = 0; i < count; i++) {
      const bias = rand(`${seed}:bright:${i}`);
      const weighted = Math.pow(bias, brightnessBias);
      list.push({
        x: rand(`${seed}:x:${i}`) * width,
        y: rand(`${seed}:y:${i}`) * height,
        radius: minRadius + weighted * (maxRadius - minRadius),
        baseAlpha: minAlpha + weighted * (maxAlpha - minAlpha),
        period: randRange(`${seed}:period:${i}`, twinklePeriodMin, twinklePeriodMax),
        phase: rand(`${seed}:phase:${i}`) * Math.PI * 2,
      });
    }
    return list;
  }, [
    count,
    seed,
    width,
    height,
    minRadius,
    maxRadius,
    brightnessBias,
    minAlpha,
    maxAlpha,
    twinklePeriodMin,
    twinklePeriodMax,
  ]);

  const ref = useCanvasDraw(width, height, (ctx) => {
    for (const star of stars) {
      const twinkle =
        1 - twinkleDepth + twinkleDepth * Math.sin((frame / star.period) * Math.PI * 2 + star.phase);
      ctx.beginPath();
      ctx.fillStyle = withAlpha(color, star.baseAlpha * twinkle);
      ctx.arc(star.x, star.y, star.radius, 0, Math.PI * 2);
      ctx.fill();
    }
  });

  return <canvas ref={ref} style={style} />;
};
