import React, { useLayoutEffect, useRef } from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { z } from "zod";
import { drawGlow, drawGrain } from "./background";
import {
  BLOOM_ALPHA,
  BLOOM_BUCKETS,
  BLOOM_SIZE_MULTIPLIER,
  DEPTH_BUCKETS,
  SPARKLE_BLOOM_ALPHA,
  SPARKLE_BLOOM_SIZE,
  SPARKLE_CORE_SIZE,
  SPARKLE_CROSS_SIZE,
} from "./constants";
import { COLOR_BUCKETS } from "./palette";
import { FIELD, sampleParticle, type ParticleSample } from "./particles";
import { getSprites } from "./sprites";
import { clamp } from "./random";

export const particleWaveSchema = z.object({
  variant: z.enum(["gold", "silver"]),
});

export type ParticleWaveProps = z.infer<typeof particleWaveSchema>;

const isBloomBucket = (bucket: number) =>
  (BLOOM_BUCKETS as readonly number[]).includes(bucket);

// Draws a cached sprite centred on (x, y) at `size` pixels across.
const stamp = (
  ctx: CanvasRenderingContext2D,
  sprite: HTMLCanvasElement,
  x: number,
  y: number,
  size: number,
  alpha: number,
) => {
  if (alpha <= 0.002 || size <= 0.2) {
    return;
  }
  ctx.globalAlpha = alpha > 1 ? 1 : alpha;
  ctx.drawImage(sprite, x - size / 2, y - size / 2, size, size);
};

const renderFrame = (
  ctx: CanvasRenderingContext2D,
  frame: number,
  width: number,
  height: number,
  variant: ParticleWaveProps["variant"],
) => {
  const sprites = getSprites(variant);

  drawGlow(ctx, frame, width, height, variant);

  // One pass over the field, bucketed by depth and then by colour, so
  // each sprite is used for a contiguous run of draws.
  const groups: ParticleSample[][] = Array.from(
    { length: DEPTH_BUCKETS * COLOR_BUCKETS },
    () => [],
  );
  const sparkling: ParticleSample[] = [];

  for (const particle of FIELD) {
    const sample = sampleParticle(particle, frame, width, height);
    // Cull what cannot contribute: off-frame, or faded to nothing.
    const margin = sample.size * 3;
    if (
      sample.alpha < 0.004 ||
      sample.y < -margin ||
      sample.y > height + margin ||
      sample.x < -margin ||
      sample.x > width + margin
    ) {
      continue;
    }
    groups[particle.bucket * COLOR_BUCKETS + particle.colorIndex].push(sample);
    if (sample.sparkle > 0) {
      sparkling.push(sample);
    }
  }

  // Additive compositing throughout, so overlapping particles build
  // brightness the way real out-of-focus glitter does.
  ctx.globalCompositeOperation = "lighter";

  // Bloom under the sharp mid-depth band only. The big near orbs are
  // deliberately excluded — if they glow, the depth reads inverted.
  for (let bucket = 0; bucket < DEPTH_BUCKETS; bucket++) {
    if (!isBloomBucket(bucket)) {
      continue;
    }
    for (let color = 0; color < COLOR_BUCKETS; color++) {
      for (const sample of groups[bucket * COLOR_BUCKETS + color]) {
        stamp(
          ctx,
          sprites.bloom,
          sample.x,
          sample.y,
          sample.size * BLOOM_SIZE_MULTIPLIER,
          sample.alpha * BLOOM_ALPHA,
        );
      }
    }
  }

  // Far buckets first, near last.
  for (let bucket = DEPTH_BUCKETS - 1; bucket >= 0; bucket--) {
    for (let color = 0; color < COLOR_BUCKETS; color++) {
      const sprite = sprites.dots[bucket][color];
      for (const sample of groups[bucket * COLOR_BUCKETS + color]) {
        // A flashing particle blows out briefly before the cross lands.
        const boost = 1 + sample.sparkle * 0.8;
        stamp(ctx, sprite, sample.x, sample.y, sample.size, sample.alpha * boost);
      }
    }
  }

  for (const sample of sparkling) {
    const scale = clamp(sample.size / (0.004 * height), 0.7, 1.7);
    const alpha = sample.sparkle * clamp(sample.alpha * 1.8);
    stamp(
      ctx,
      sprites.sparkleBloom,
      sample.x,
      sample.y,
      SPARKLE_BLOOM_SIZE * height * scale,
      alpha * SPARKLE_BLOOM_ALPHA,
    );
    stamp(
      ctx,
      sprites.sparkleCross,
      sample.x,
      sample.y,
      SPARKLE_CROSS_SIZE * height * scale,
      alpha,
    );
    stamp(
      ctx,
      sprites.sparkleCore,
      sample.x,
      sample.y,
      SPARKLE_CORE_SIZE * height * scale,
      alpha,
    );
  }

  ctx.globalAlpha = 1;
  drawGrain(ctx, sprites, frame, width, height);
  ctx.globalCompositeOperation = "source-over";
};

export const ParticleWave: React.FC<ParticleWaveProps> = ({ variant }) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // useLayoutEffect, not useEffect: the frame must be fully painted
  // before Remotion captures it.
  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }
    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) {
      return;
    }
    renderFrame(ctx, frame, width, height, variant);
  }, [frame, width, height, variant]);

  return (
    <AbsoluteFill style={{ backgroundColor: "#000000" }}>
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        style={{ width: "100%", height: "100%", display: "block" }}
      />
    </AbsoluteFill>
  );
};
