import React, { useLayoutEffect } from "react";
import { CONFIG } from "./config";
import { rgba } from "./color";
import { createBuffer } from "./draw";
import type { PassProps } from "./passes";

/**
 * Near-black, with broad regions marginally lighter than others and one
 * corner softly lifted. Computed at 1/8 resolution and upscaled with high
 * quality smoothing, which is both far cheaper and guarantees no edge in the
 * variation is discernible.
 *
 * This is the first pass, so it also clears the frame.
 */
export const BackgroundWash: React.FC<PassProps> = ({ canvasRef, scene }) => {
  useLayoutEffect(() => {
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;

    const { width, height } = scene;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";
    ctx.filter = "none";
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = rgba(scene.background, 1);
    ctx.fillRect(0, 0, width, height);

    const step = CONFIG.background.downscale;
    // The small canvas is padded so the blur has something to sample beyond
    // the frame edge; without it the lift would fade out along the borders.
    const pad = 24;
    const smallW = Math.ceil(width / step);
    const smallH = Math.ceil(height / step);
    const small = createBuffer(smallW + pad * 2, smallH + pad * 2);
    const smallCtx = small.getContext("2d");
    if (!smallCtx) return;

    smallCtx.globalCompositeOperation = "lighter";
    const lift = scene.tones[0];

    for (const blob of scene.blobs) {
      const cx = pad + blob.x * smallW;
      const cy = pad + blob.y * smallH;
      const radius = blob.radius * smallW;
      const gradient = smallCtx.createRadialGradient(cx, cy, 0, cx, cy, radius);
      gradient.addColorStop(0, rgba(lift, blob.lift));
      gradient.addColorStop(0.6, rgba(lift, blob.lift * 0.45));
      gradient.addColorStop(1, rgba(lift, 0));
      smallCtx.fillStyle = gradient;
      smallCtx.fillRect(cx - radius, cy - radius, radius * 2, radius * 2);
    }

    // One corner lifted, fading across the full diagonal.
    const cornerX = pad + scene.corner.x * smallW;
    const cornerY = pad + scene.corner.y * smallH;
    const directional = smallCtx.createLinearGradient(
      cornerX,
      cornerY,
      pad + (1 - scene.corner.x) * smallW,
      pad + (1 - scene.corner.y) * smallH,
    );
    directional.addColorStop(0, rgba(lift, CONFIG.background.cornerLift));
    directional.addColorStop(1, rgba(lift, 0));
    smallCtx.fillStyle = directional;
    smallCtx.fillRect(0, 0, small.width, small.height);

    const blurred = createBuffer(small.width, small.height);
    const blurredCtx = blurred.getContext("2d");
    if (!blurredCtx) return;
    blurredCtx.filter = `blur(${CONFIG.background.blur}px)`;
    blurredCtx.drawImage(small, 0, 0);

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.globalCompositeOperation = "lighter";
    ctx.drawImage(blurred, pad, pad, smallW, smallH, 0, 0, width, height);
    ctx.globalCompositeOperation = "source-over";
  }, [canvasRef, scene]);

  return null;
};
