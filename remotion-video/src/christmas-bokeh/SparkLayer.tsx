import React, { useLayoutEffect, useMemo, useRef } from "react";
import { ambientDrift } from "./ambient";
import { applyBloom, createBloomBuffers } from "./bloom";
import { scaleFor } from "./config";
import {
  buildSparkSprite,
  generateSparks,
  sparkBrightness,
  SPARK_HALO_FACTOR,
  type SparkTone,
} from "./sparks";
import type { Theme } from "./theme";
import { useLoopFrame } from "./useLoopFrame";

type Props = {
  width: number;
  height: number;
  theme: Theme;
};

const TONES: SparkTone[] = ["spark", "cream", "white"];

/**
 * The twinkle layer. Three sprites are baked — one per tone — and every
 * spark is the same sprite blitted at its own scale and alpha, so 120
 * points cost three gradients total rather than 120 per frame.
 */
export const SparkLayer: React.FC<Props> = ({ width, height, theme }) => {
  const frame = useLoopFrame();
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const scale = scaleFor(width);
  const sparks = useMemo(
    () => generateSparks(width, height, scale),
    [width, height, scale],
  );
  const sprites = useMemo(() => {
    const map = new Map<SparkTone, HTMLCanvasElement | null>();
    for (const tone of TONES) map.set(tone, buildSparkSprite(theme, tone));
    return map;
  }, [theme]);
  const bloom = useMemo(
    () => createBloomBuffers(width, height),
    [width, height],
  );

  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    const drift = ambientDrift(frame, scale);

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, width, height);
    ctx.translate(drift.x, drift.y);
    ctx.globalCompositeOperation = "lighter";

    for (const spark of sparks) {
      const sprite = sprites.get(spark.tone);
      if (!sprite) continue;

      const brightness = sparkBrightness(spark, frame);
      // A flash reads as the point growing as well as brightening, so the
      // extra gain past 1 is split between alpha and size.
      const grow = brightness > 1 ? 1 + (brightness - 1) * 0.45 : 1;
      const drawn = (spark.size / 2) * SPARK_HALO_FACTOR * grow;

      ctx.globalAlpha = Math.min(1, spark.baseAlpha * brightness);
      ctx.drawImage(
        sprite,
        spark.x - drawn,
        spark.y - drawn,
        drawn * 2,
        drawn * 2,
      );
    }

    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";
    ctx.setTransform(1, 0, 0, 1, 0, 0);

    if (bloom) applyBloom(ctx, canvas, bloom, 0.45);
  }, [frame, sparks, sprites, bloom, width, height, scale]);

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      style={{
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
        mixBlendMode: "screen",
      }}
    />
  );
};
