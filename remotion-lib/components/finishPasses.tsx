/**
 * Finishing passes: bloom, vignette, grain.
 *
 * All three are low-frequency by nature, so all three render into a
 * canvas much smaller than the frame and are scaled back up by the
 * browser. At 4K that is the difference between 8.3 million pixels of
 * fill per pass and half a million, and the result is indistinguishable
 * once blurred, darkened or dithered.
 *
 * <BloomPass> takes a `draw` callback rather than an image: you redraw
 * only the bright elements — the top slice of a particle field, the
 * travelling highlights on a ribbon — into the reduced buffer, and the
 * browser's blur plus a screen blend does the rest. Two passes at
 * different radii read as a generous bloom; one alone reads as a smudge.
 *
 * @example
 * <BloomPass width={3840} height={2160} scale={0.25} blur={9} opacity={0.75}
 *   draw={(ctx, s) => drawParticleField(ctx, field, { ...o, sizeScale: 1/s })} />
 */
import React from "react";
import { DrawCanvas } from "./DrawCanvas";
import { makeRng } from "./rng";

/**
 * Redraws bright elements small, blurs them, and screens them back over
 * the frame. `draw` receives the reduced context and the scale factor it
 * has been given, so it can compensate where it needs to (particle sizes
 * would otherwise vanish at a quarter scale).
 */
export const BloomPass: React.FC<{
  width: number;
  height: number;
  scale: number;
  blur: number;
  opacity: number;
  draw: (ctx: CanvasRenderingContext2D, scale: number) => void;
}> = ({ width, height, scale, blur, opacity, draw }) => (
  <DrawCanvas
    width={Math.round(width * scale)}
    height={Math.round(height * scale)}
    style={{
      filter: `blur(${blur}px)`,
      mixBlendMode: "screen",
      opacity,
      pointerEvents: "none",
    }}
    draw={(ctx) => {
      ctx.scale(scale, scale);
      draw(ctx, scale);
    }}
  />
);

/** A soft elliptical darkening toward the frame corners. */
export const VignettePass: React.FC<{
  width: number;
  height: number;
  color: string;
  strength: number;
  scale?: number;
}> = ({ width, height, color, strength, scale = 0.25 }) => {
  const w = Math.round(width * scale);
  const h = Math.round(height * scale);
  const n = parseInt(color.slice(1), 16);
  const rgb = `${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}`;
  return (
    <DrawCanvas
      width={w}
      height={h}
      style={{ pointerEvents: "none" }}
      draw={(ctx) => {
        const g = ctx.createRadialGradient(
          w / 2,
          h / 2,
          Math.min(w, h) * 0.28,
          w / 2,
          h / 2,
          Math.max(w, h) * 0.72,
        );
        g.addColorStop(0, `rgba(${rgb}, 0)`);
        g.addColorStop(0.62, `rgba(${rgb}, ${(strength * 0.42).toFixed(3)})`);
        g.addColorStop(1, `rgba(${rgb}, ${strength.toFixed(3)})`);
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, w, h);
      }}
    />
  );
};

/**
 * Fine monochrome grain, reseeded every frame from `frame % duration` so
 * it is deterministic, never repeats within a loop, and lines up exactly
 * when the loop restarts.
 */
export const GrainPass: React.FC<{
  tileWidth: number;
  tileHeight: number;
  frame: number;
  duration: number;
  alpha: number;
  seed?: string;
}> = ({ tileWidth, tileHeight, frame, duration, alpha, seed = "grain" }) => (
  <DrawCanvas
    width={tileWidth}
    height={tileHeight}
    style={{ opacity: alpha, mixBlendMode: "overlay", pointerEvents: "none" }}
    draw={(ctx) => {
      const image = ctx.createImageData(tileWidth, tileHeight);
      const data = image.data;
      const rng = makeRng(`${seed}:${frame % duration}`);
      for (let i = 0; i < data.length; i += 4) {
        const v = (rng() * 255) | 0;
        data[i] = v;
        data[i + 1] = v;
        data[i + 2] = v;
        data[i + 3] = 255;
      }
      ctx.putImageData(image, 0, 0);
    }}
  />
);
