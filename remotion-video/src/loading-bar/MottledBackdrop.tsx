import React, { useMemo } from "react";
import { Canvas2D } from "./lib/Canvas2D";
import { rgba } from "./lib/color";
import { lowResUpscale, makeCanvas, paintLowRes } from "./lib/lowResUpscale";
import { glowPool } from "./lib/postFx";
import { seeded, seededRange } from "./lib/rand";

export type MottledBackdropProps = {
  width: number;
  height: number;
  /** Base surface colour. */
  deep: string;
  /** Colour of the lighter patches. */
  mottle: string;
  /** Broad pool of light the subject sits in. */
  glow: {
    color: string;
    centerX: number;
    centerY: number;
    radiusX: number;
    radiusY: number;
    alpha: number;
  };
  blobs?: number;
  seed: string;
};

/**
 * A dark, unevenly lit surface: broad soft patches of lighter and
 * darker paint, heavily blurred, with a large glow pool where the
 * subject sits.
 *
 * Entirely static, so the whole thing is rasterised once into a
 * full-resolution offscreen canvas and blitted per frame. The mottling
 * itself is computed at 1/8 resolution and upscaled with high-quality
 * smoothing — it is all soft gradient, so the upscale is the blur.
 */
export const MottledBackdrop: React.FC<MottledBackdropProps> = ({
  width,
  height,
  deep,
  mottle,
  glow,
  blobs = 62,
  seed,
}) => {
  const baked = useMemo(() => {
    const small = paintLowRes(width, height, 8, (ctx, w, h) => {
      ctx.fillStyle = deep;
      ctx.fillRect(0, 0, w, h);

      for (let i = 0; i < blobs; i++) {
        const cx = seeded(`${seed}-blob-x-${i}`) * w;
        const cy = seeded(`${seed}-blob-y-${i}`) * h;
        const r = seededRange(`${seed}-blob-r-${i}`, w * 0.05, w * 0.34);
        // Roughly two lighter patches for every darker one: the wall is
        // lit, not stained.
        const lighter = seeded(`${seed}-blob-kind-${i}`) > 0.34;
        const alpha = seededRange(`${seed}-blob-a-${i}`, 0.14, 0.5);
        const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
        if (lighter) {
          grad.addColorStop(0, rgba(mottle, alpha));
          grad.addColorStop(1, rgba(mottle, 0));
        } else {
          grad.addColorStop(0, `rgba(0, 0, 0, ${alpha * 0.85})`);
          grad.addColorStop(1, "rgba(0, 0, 0, 0)");
        }
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.fill();
      }
    });

    const full = makeCanvas(width, height);
    const ctx = full.getContext("2d");
    if (ctx) {
      ctx.fillStyle = deep;
      ctx.fillRect(0, 0, width, height);
      lowResUpscale(ctx, small, width, height);
      glowPool(
        ctx,
        glow.centerX,
        glow.centerY,
        glow.radiusX,
        glow.radiusY,
        glow.color,
        glow.alpha,
      );
    }
    return full;
    // Deps are spelled out as primitives: `glow` is an object literal at
    // the call site and would otherwise re-bake the backdrop every frame.
  }, [
    width,
    height,
    deep,
    mottle,
    blobs,
    seed,
    glow.color,
    glow.centerX,
    glow.centerY,
    glow.radiusX,
    glow.radiusY,
    glow.alpha,
  ]);

  return (
    <Canvas2D
      width={width}
      height={height}
      opaque
      draw={(ctx) => {
        ctx.drawImage(baked, 0, 0);
      }}
    />
  );
};
