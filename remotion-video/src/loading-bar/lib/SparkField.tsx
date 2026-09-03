import React, { useMemo } from "react";
import { Canvas2D } from "./Canvas2D";
import { rgba } from "./color";
import { seeded, seededRange, seededSigned } from "./rand";

export type Spark = {
  x: number;
  y: number;
  radius: number;
  driftX: number;
  driftY: number;
  phase: number;
  speed: number;
  base: number;
};

export type SparkFieldProps = {
  width: number;
  height: number;
  frame: number;
  count?: number;
  color: string;
  /** The bar's leading edge, in frame coordinates. Dust brightens near it. */
  lightX: number;
  lightY: number;
  /** Falloff radius of that brightening. */
  lightRadius: number;
  /** 0 before the fill starts, 1 once it is running. */
  lightStrength: number;
  scale: number;
  seed: string;
  blend?: React.CSSProperties["mixBlendMode"];
};

/**
 * Fine dust and sparks drifting slowly through the frame, brighter
 * where the bar's light is strongest.
 *
 * Each particle's identity is derived from its index through a stable
 * seed, and its position is `base + drift * frame` wrapped into the
 * frame — a pure function of (index, frame), so workers rendering
 * different frames agree exactly.
 */
export const SparkField: React.FC<SparkFieldProps> = ({
  width,
  height,
  frame,
  count = 250,
  color,
  lightX,
  lightY,
  lightRadius,
  lightStrength,
  scale,
  seed,
  blend = "screen",
}) => {
  const sparks = useMemo<Spark[]>(() => {
    const out: Spark[] = [];
    for (let i = 0; i < count; i++) {
      out.push({
        x: seeded(`${seed}-x-${i}`) * width,
        y: seeded(`${seed}-y-${i}`) * height,
        radius: seededRange(`${seed}-r-${i}`, 1.1, 4.6) * scale,
        driftX: seededSigned(`${seed}-dx-${i}`, 0.34) * scale,
        driftY: -seededRange(`${seed}-dy-${i}`, 0.06, 0.42) * scale,
        phase: seeded(`${seed}-p-${i}`) * Math.PI * 2,
        speed: seededRange(`${seed}-s-${i}`, 0.012, 0.06),
        base: seededRange(`${seed}-b-${i}`, 0.12, 0.5),
      });
    }
    return out;
  }, [count, width, height, scale, seed]);

  return (
    <Canvas2D
      width={width}
      height={height}
      blend={blend}
      draw={(ctx) => {
        ctx.save();
        ctx.globalCompositeOperation = "lighter";
        const margin = width * 0.05;
        const spanX = width + margin * 2;
        const spanY = height + margin * 2;

        for (const spark of sparks) {
          const x =
            ((((spark.x + spark.driftX * frame + margin) % spanX) + spanX) %
              spanX) -
            margin;
          const y =
            ((((spark.y + spark.driftY * frame + margin) % spanY) + spanY) %
              spanY) -
            margin;

          const twinkle = 0.55 + 0.45 * Math.sin(frame * spark.speed + spark.phase);
          const d = Math.hypot(x - lightX, y - lightY) / lightRadius;
          const lit = 1 + 2.6 * lightStrength * Math.exp(-d * d);
          const alpha = Math.min(1, spark.base * twinkle * lit);
          const radius = spark.radius * (1 + 0.35 * (lit - 1));

          ctx.globalAlpha = alpha;
          ctx.fillStyle = rgba(color, 1);
          ctx.shadowBlur = radius * 4;
          ctx.shadowColor = rgba(color, 0.9);
          ctx.beginPath();
          ctx.arc(x, y, radius, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      }}
    />
  );
};
