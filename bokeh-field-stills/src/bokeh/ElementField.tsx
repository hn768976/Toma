import React, { useLayoutEffect } from "react";
import { compositeBuffer, createBuffer, paintElements, rimStrength } from "./draw";
import type { PassProps } from "./passes";

/**
 * The field itself. Elements are bucketed into five bands by how defocused
 * they are; each band is painted into one padded offscreen buffer and that
 * buffer is blurred exactly once on its way back into the frame. Blurring
 * ~1400 elements individually at 4K is unusably slow.
 *
 * Five bands rather than the usual three because this piece's blur range runs
 * from razor sharp to ~60px, which three buckets quantise far too coarsely.
 *
 * Bands are composited most-defocused first. Everything accumulates with
 * 'lighter', so overlapping marks pool into hot regions.
 */
export const ElementField: React.FC<PassProps> = ({ canvasRef, scene }) => {
  useLayoutEffect(() => {
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;

    const { padding } = scene;
    const buffer = createBuffer(scene.width + padding * 2, scene.height + padding * 2);
    const bufferCtx = buffer.getContext("2d");
    if (!bufferCtx) return;

    for (const band of scene.bands) {
      bufferCtx.setTransform(1, 0, 0, 1, 0, 0);
      bufferCtx.clearRect(0, 0, buffer.width, buffer.height);
      paintElements(bufferCtx, band.elements, rimStrength(band.blur, scene.scale), padding);
      compositeBuffer(ctx, buffer, band.blur, padding);
    }
  }, [canvasRef, scene]);

  return null;
};
