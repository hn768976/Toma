import React, { useCallback } from "react";
import { CanvasLayer, makeBuffer } from "./CanvasLayer";
import { seededStream } from "./rng";
import type { CompositionSpec } from "./types";

/** Grain is generated at half resolution and upscaled; at 4K that is still
 *  finer than anything else in the frame, and it costs a quarter as much. */
const DOWNSCALE = 2;
const AMPLITUDE = 26;

/**
 * A neutral monochrome grain laid over the finished frame with 'overlay', so
 * mid-grey is a no-op and the noise pushes each pixel slightly up or down.
 */
export const GrainPass: React.FC<{ spec: CompositionSpec }> = ({ spec }) => {
  const draw = useCallback(
    (ctx: CanvasRenderingContext2D, width: number, height: number) => {
      const gw = Math.round(width / DOWNSCALE);
      const gh = Math.round(height / DOWNSCALE);
      const buffer = makeBuffer(gw, gh);
      const bctx = buffer.getContext("2d");
      if (!bctx) return;

      const image = bctx.createImageData(gw, gh);
      const data = image.data;
      const rand = seededStream(spec.id, "grain");
      for (let i = 0; i < data.length; i += 4) {
        const v = 128 + (rand() - 0.5) * 2 * AMPLITUDE;
        data[i] = v;
        data[i + 1] = v;
        data[i + 2] = v;
        data[i + 3] = 255;
      }
      bctx.putImageData(image, 0, 0);

      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(buffer, 0, 0, width, height);
    },
    [spec],
  );

  return <CanvasLayer draw={draw} blend="overlay" opacity={spec.grain * 0.5} />;
};
