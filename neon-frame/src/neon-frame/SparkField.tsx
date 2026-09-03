/**
 * Small bright points floating among the rain.
 *
 * Deliberately distinct from the rain: sparks do not fall in columns, they
 * drift on small closed paths and twinkle. Each one takes its hue from the
 * palette's accent set and its own depth drives size and brightness.
 */
import React, { useMemo } from "react";
import { useCurrentFrame } from "remotion";
import { HEIGHT, WIDTH, layerStyle, loopedFrame } from "./constants";
import { TAU, lerp, offscreen, useCanvas2D } from "../lib/canvas";
import { DIVISORS_OF_360, rand01, randPick, randRange } from "../lib/random";
import { blitSprite, lightSprite } from "../lib/sprites";
import { bloomPass } from "../lib/bloom-pass";
import { accentSet, type VariantConfig } from "./variants";

const SPARK_COUNT = 200;
const BLOOM_SCALE = 1 / 6;
/** Drift and twinkle periods, all divisors of 360. */
const MOTION_PERIODS = [60, 72, 90, 120, 180, 360] as const;

type Spark = {
  x: number;
  y: number;
  z: number;
  radiusX: number;
  radiusY: number;
  driftPeriod: number;
  driftPhase: number;
  twinklePeriod: number;
  twinklePhase: number;
  size: number;
  alpha: number;
  color: string;
};

const buildSparks = (variant: VariantConfig, seedKey: string): Spark[] => {
  const accents = accentSet(variant);
  return new Array(SPARK_COUNT).fill(0).map((_unused, i) => {
    const z = rand01(`${seedKey}-spark-z-${i}`);
    return {
      x: rand01(`${seedKey}-spark-x-${i}`) * WIDTH,
      y: rand01(`${seedKey}-spark-y-${i}`) * HEIGHT,
      z,
      radiusX: randRange(`${seedKey}-spark-rx-${i}`, 14, 70),
      radiusY: randRange(`${seedKey}-spark-ry-${i}`, 8, 46),
      driftPeriod: randPick(`${seedKey}-spark-dp-${i}`, MOTION_PERIODS),
      driftPhase: rand01(`${seedKey}-spark-dph-${i}`),
      twinklePeriod: randPick(
        `${seedKey}-spark-tp-${i}`,
        DIVISORS_OF_360.slice(8),
      ),
      twinklePhase: rand01(`${seedKey}-spark-tph-${i}`),
      size: lerp(4, 14, z),
      alpha: lerp(0.3, 0.8, z),
      color: randPick(`${seedKey}-spark-col-${i}`, accents),
    };
  });
};

export const SparkField: React.FC<{
  variant: VariantConfig;
  seedKey: string;
}> = ({ variant, seedKey }) => {
  const frame = useCurrentFrame();
  const f = loopedFrame(frame);
  const sparks = useMemo(
    () => buildSparks(variant, seedKey),
    [variant, seedKey],
  );
  const bloom = useMemo(
    () =>
      offscreen(
        Math.round(WIDTH * BLOOM_SCALE),
        Math.round(HEIGHT * BLOOM_SCALE),
      ),
    [],
  );

  const ref = useCanvas2D((ctx, width, height) => {
    bloom.ctx.setTransform(1, 0, 0, 1, 0, 0);
    bloom.ctx.globalAlpha = 1;
    bloom.ctx.globalCompositeOperation = "source-over";
    bloom.ctx.clearRect(0, 0, bloom.canvas.width, bloom.canvas.height);
    bloom.ctx.globalCompositeOperation = "lighter";

    ctx.globalCompositeOperation = "lighter";

    for (const spark of sparks) {
      const theta = TAU * (f / spark.driftPeriod + spark.driftPhase);
      const x = spark.x + spark.radiusX * Math.cos(theta);
      const y = spark.y + spark.radiusY * Math.sin(2 * theta);

      const twinkle = 0.5 + 0.5 * Math.sin(
        TAU * (f / spark.twinklePeriod + spark.twinklePhase),
      );
      const intensity = 0.2 + Math.pow(twinkle, 2.6) * 0.95;
      const size = spark.size * (0.75 + intensity * 0.55);
      const sprite = lightSprite(spark.color, 0.08, 2.8);

      blitSprite(ctx, sprite, x, y, size * 4.5, size * 4.5, spark.alpha * intensity * 0.22);
      blitSprite(ctx, sprite, x, y, size, size, spark.alpha * intensity);

      blitSprite(
        bloom.ctx,
        sprite,
        x * BLOOM_SCALE,
        y * BLOOM_SCALE,
        size * 4 * BLOOM_SCALE,
        size * 4 * BLOOM_SCALE,
        spark.alpha * intensity * 0.35,
      );
    }

    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";

    bloomPass(ctx, bloom.canvas, width, height, {
      wideRadius: 22,
      tightRadius: 7,
      wideStrength: 0.24,
      tightStrength: 0.2,
    });
  });

  return <canvas ref={ref} width={WIDTH} height={HEIGHT} style={layerStyle} />;
};
