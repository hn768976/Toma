import React, { useLayoutEffect, useMemo, useRef } from "react";
import { useCurrentFrame, useVideoConfig } from "remotion";

import {
  buildField,
  createSample,
  ORB,
  PINPOINT,
  sampleEmber,
  type EmberConfig,
} from "./field";
import { drawHaze, drawHazeGrain } from "./haze";
import { heatBucket } from "./palette";
import { getSprites, stretchBucket } from "./sprites";

/** Bloom sits under the core, not over it — a halo, not a wash. */
const BLOOM_STRENGTH = 0.8;

/** Typical distance covered per frame, used to normalise streak stretching. */
const REFERENCE_SPEED = 0.0069;

export type EmbersProps = {
  readonly config: EmberConfig;
  /** Identifies the sprite cache; must differ per palette. */
  readonly variant: string;
};

export const Embers: React.FC<EmbersProps> = ({ config, variant }) => {
  const frame = useCurrentFrame();
  const { width, height, durationInFrames } = useVideoConfig();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const hazeRef = useRef<HTMLCanvasElement | null>(null);
  const grainRef = useRef<HTMLCanvasElement | null>(null);

  // The field is generated once from a seeded PRNG and never mutated. Remotion
  // renders frames out of order across threads, so anything stateful here would
  // both flicker and fail to loop.
  const field = useMemo(() => buildField(config), [config]);
  const sample = useMemo(() => createSample(), []);

  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) return;

    const sprites = getSprites(config.palette, variant);
    const aspect = width / height;

    // Scratch buffers, reused across frames. They hold no state between
    // frames — everything in them is cleared and redrawn from `frame`.
    const buffer = (ref: React.RefObject<HTMLCanvasElement | null>) => {
      if (!ref.current) ref.current = document.createElement("canvas");
      const c = ref.current;
      if (c.width !== width || c.height !== height) {
        c.width = width;
        c.height = height;
      }
      return c;
    };
    const hazeCanvas = buffer(hazeRef);
    const grainCanvas = buffer(grainRef);
    const hazeCtx = hazeCanvas.getContext("2d");
    const grainCtx = grainCanvas.getContext("2d");
    if (!hazeCtx || !grainCtx) return;

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = 1;
    ctx.fillStyle = "#000000";
    ctx.fillRect(0, 0, width, height);

    drawHaze(
      hazeCtx,
      width,
      height,
      frame,
      durationInFrames,
      config.palette,
      config.hazeIntensity,
      variant,
    );
    ctx.drawImage(hazeCanvas, 0, 0);

    drawHazeGrain(
      grainCtx,
      width,
      height,
      frame,
      durationInFrames,
      config.palette,
      config.hazeIntensity,
      variant,
    );

    // Additive from here on, so overlapping embers build brightness the way
    // real light does. Draw order no longer affects the result.
    ctx.globalCompositeOperation = "lighter";
    ctx.drawImage(grainCanvas, 0, 0);

    for (const e of field) {
      sampleEmber(e, frame, durationInFrames, aspect, sample);
      if (!sample.visible) continue;

      const px = sample.x * width;
      const py = sample.y * height;
      const radius = e.size * height;
      const bucket = heatBucket(sample.heat);

      if (e.cls === ORB) {
        // Large, defocused, dim. No bloom: if the foreground orbs start
        // glowing, the depth reads inverted.
        const sprite = sprites.orbs[e.softness][bucket];
        const d = radius * 2;
        ctx.globalAlpha = Math.min(1, sample.alpha);
        ctx.drawImage(sprite, px - radius, py - radius, d, d);
        continue;
      }

      if (e.cls === PINPOINT) {
        const bloom = sprites.blooms[e.softness][bucket];
        const br = radius * e.bloomScale;
        ctx.globalAlpha = Math.min(1, sample.alpha * BLOOM_STRENGTH);
        ctx.drawImage(bloom, px - br, py - br, br * 2, br * 2);

        // The core is filled directly rather than blitted, so it stays hard
        // edged at any output resolution.
        ctx.globalAlpha = Math.min(1, sample.alpha);
        ctx.fillStyle = sprites.coreFill[bucket];
        ctx.beginPath();
        ctx.arc(px, py, radius, 0, Math.PI * 2);
        ctx.fill();
        continue;
      }

      // Streak: elongated along the velocity vector, computed from the
      // particle's own motion rather than assumed vertical.
      const speedScale =
        0.82 +
        0.3 *
          Math.min(2, Math.max(0.4, sample.speed / REFERENCE_SPEED));
      const length = radius * 2 * e.stretch * speedScale;
      const thickness = radius * 2;
      const sprite = sprites.streaks[stretchBucket(e.stretch)][e.softness][bucket];

      ctx.save();
      ctx.translate(px, py);
      ctx.rotate(Math.atan2(sample.dy, sample.dx));
      ctx.globalAlpha = Math.min(1, sample.alpha);
      ctx.drawImage(sprite, -length / 2, -thickness / 2, length, thickness);
      ctx.restore();
    }

    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";
  }, [frame, width, height, durationInFrames, config, field, sample, variant]);

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      style={{ width, height, display: "block", backgroundColor: "#000000" }}
    />
  );
};
