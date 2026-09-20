import React, { useLayoutEffect, useMemo, useRef } from "react";
import { useCurrentFrame, useVideoConfig } from "remotion";
import { mulberry32 } from "../core/noise";

/**
 * A very faint animated grain overlay.
 *
 * Both pieces are almost entirely near-black gradient, which is exactly where
 * 8-bit H.264 banding shows up worst. A little moving noise dithers those
 * gradients and keeps the dark falloff smooth after encoding.
 *
 * The noise is tiled into a real canvas rather than set as a CSS
 * `background-image`: a data URI still has to be decoded asynchronously, so a
 * frame can be captured before it appears. Drawing in a layout effect happens
 * before paint, which makes every frame identical to every other run.
 */
const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));

/**
 * Per-frame tile offset. For a looping composition the stride is rounded to a
 * multiple of `tile / gcd(loopFrames, tile)`, which is exactly the condition
 * for `loopFrames * stride` to be a whole number of tiles -- so the grain
 * lands back where it started and does not break the loop.
 */
const strideFor = (
  preferred: number,
  tile: number,
  loopFrames: number | undefined,
): number => {
  if (!loopFrames) {
    return preferred;
  }

  const quantum = tile / gcd(loopFrames, tile);
  return Math.max(quantum, Math.round(preferred / quantum) * quantum);
};

export const FilmGrain: React.FC<{
  opacity?: number;
  tile?: number;
  /** Set on looping compositions so the grain loops with them. */
  loopFrames?: number;
}> = ({ opacity = 0.035, tile = 128, loopFrames }) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const tileCanvas = useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = tile;
    canvas.height = tile;

    const ctx = canvas.getContext("2d");
    if (!ctx) {
      return null;
    }

    const image = ctx.createImageData(tile, tile);
    const rnd = mulberry32(0x9a1e77);
    for (let i = 0; i < tile * tile; i++) {
      const v = Math.round(rnd() * 255);
      const o = i * 4;
      image.data[o] = v;
      image.data[o + 1] = v;
      image.data[o + 2] = v;
      image.data[o + 3] = 255;
    }
    ctx.putImageData(image, 0, 0);
    return canvas;
  }, [tile]);

  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !tileCanvas) {
      return;
    }

    // `--scale` comes through as devicePixelRatio, so the grain stays one
    // output pixel per sample at both 1080p and 4K.
    const ratio = window.devicePixelRatio || 1;
    const w = Math.max(1, Math.round(width * ratio));
    const h = Math.max(1, Math.round(height * ratio));
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }

    const ctx = canvas.getContext("2d");
    if (!ctx) {
      return;
    }

    const pattern = ctx.createPattern(tileCanvas, "repeat");
    if (!pattern) {
      return;
    }

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = pattern;
    // A different stride on each axis avoids a visible repeat cadence.
    const stepX = strideFor(37, tile, loopFrames);
    const stepY = strideFor(53, tile, loopFrames);
    ctx.translate((frame * stepX) % tile, (frame * stepY) % tile);
    ctx.fillRect(-tile, -tile, w + tile * 2, h + tile * 2);
  }, [frame, width, height, tile, tileCanvas, loopFrames]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
        opacity,
        mixBlendMode: "overlay",
        pointerEvents: "none",
      }}
    />
  );
};
