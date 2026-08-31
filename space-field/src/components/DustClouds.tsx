import React, { useCallback, useMemo } from "react";
import { useCurrentFrame, useVideoConfig } from "remotion";
import { hexToRgb, rgba } from "../lib/color";
import { TAU, loopPhase } from "../lib/math";
import { buildDust } from "../particles";
import type { Variant } from "../variants";
import { CanvasLayer, makeOffscreen } from "./CanvasLayer";

/** The dust layer is computed at 1/8 resolution and upscaled. */
const DOWNSCALE = 8;

/**
 * Large, very faint radial blobs composited additively and then blurred until
 * no blob edge survives. Each drifts on a closed Lissajous path with integer
 * frequency multipliers and breathes +/-12% on an integer-frequency sine, so
 * the whole layer returns exactly to its starting state at the loop boundary.
 *
 * It is all soft gradient, so it is drawn into a 480x270 buffer, blurred there
 * (where a blur is ~64x cheaper) and upscaled with high-quality smoothing.
 * Nothing is lost that a viewer could see. Particles are never treated this
 * way — downscaling would destroy them.
 */
export const DustClouds: React.FC<{ readonly variant: Variant }> = ({
  variant,
}) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const aspect = width / height;

  const blobs = useMemo(() => buildDust(variant, aspect), [variant, aspect]);
  const colors = useMemo(
    () => (variant.dust ? variant.dust.colors.map((c) => hexToRgb(c.hex)) : []),
    [variant],
  );

  const lowWidth = Math.round(width / DOWNSCALE);
  const lowHeight = Math.round(height / DOWNSCALE);

  // Two small buffers: one to accumulate the blobs, one to hold the blurred
  // result. Created once and reused for every frame.
  const accumulator = useMemo(
    () => makeOffscreen(lowWidth, lowHeight),
    [lowWidth, lowHeight],
  );
  const blurred = useMemo(
    () => makeOffscreen(lowWidth, lowHeight),
    [lowWidth, lowHeight],
  );

  const draw = useCallback(
    (ctx: CanvasRenderingContext2D, w: number, h: number) => {
      const dust = variant.dust;
      if (!dust || blobs.length === 0) {
        return;
      }

      const low = accumulator.getContext("2d");
      const blurCtx = blurred.getContext("2d");
      if (!low || !blurCtx) {
        return;
      }

      const phase = loopPhase(frame, variant.loopLength);

      low.setTransform(1, 0, 0, 1, 0, 0);
      low.filter = "none";
      low.globalAlpha = 1;
      low.globalCompositeOperation = "source-over";
      low.clearRect(0, 0, lowWidth, lowHeight);
      low.globalCompositeOperation = "lighter";

      for (const blob of blobs) {
        const x =
          (blob.x + blob.ax * Math.cos(TAU * (blob.fx * phase + blob.px))) *
          lowWidth;
        const y =
          (blob.y + blob.ay * Math.sin(TAU * (blob.fy * phase + blob.py))) *
          lowHeight;
        const breath =
          1 +
          dust.breathAmp *
            Math.sin(TAU * (blob.breathFreq * phase + blob.breathPhase));
        const radius = blob.radius * lowWidth * breath;
        if (radius <= 0) {
          continue;
        }

        const color = colors[blob.colorIndex];
        const alpha = Math.min(1, blob.alpha * dust.gain);
        const gradient = low.createRadialGradient(x, y, 0, x, y, radius);
        gradient.addColorStop(0, rgba(color, alpha));
        gradient.addColorStop(0.4, rgba(color, alpha * 0.5));
        gradient.addColorStop(0.75, rgba(color, alpha * 0.14));
        gradient.addColorStop(1, rgba(color, 0));
        low.fillStyle = gradient;
        low.fillRect(x - radius, y - radius, radius * 2, radius * 2);
      }

      blurCtx.setTransform(1, 0, 0, 1, 0, 0);
      blurCtx.globalCompositeOperation = "source-over";
      blurCtx.globalAlpha = 1;
      blurCtx.filter = "none";
      blurCtx.clearRect(0, 0, lowWidth, lowHeight);
      blurCtx.filter = `blur(${dust.blur}px)`;
      blurCtx.drawImage(accumulator, 0, 0);
      blurCtx.filter = "none";

      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(blurred, 0, 0, lowWidth, lowHeight, 0, 0, w, h);
    },
    [variant, blobs, colors, frame, accumulator, blurred, lowWidth, lowHeight],
  );

  if (!variant.dust) {
    return null;
  }

  return <CanvasLayer draw={draw} blend="screen" />;
};
