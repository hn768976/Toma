/**
 * <GrainPass> — fine seeded film grain, recomputed every frame.
 *
 * Grain is generated at a fraction of the composition resolution and upscaled
 * by the browser. At 4K a 1:1 grain field is a million-plus samples of pure
 * overhead per frame, and the difference is invisible once the layer is at a
 * few percent opacity.
 *
 * One Remotion `random()` call seeds a cheap xorshift for the samples.
 * Hashing every pixel through `random()` would dominate the frame budget, and
 * seeding the xorshift from the frame keeps the result deterministic and
 * loop-safe: pass `frame % loopFrames` and the grain repeats with the loop.
 */

import React, { useLayoutEffect } from "react";
import { random } from "remotion";

export type GrainPassProps = {
  targetRef: React.RefObject<HTMLCanvasElement | null>;
  /** Reduce modulo the loop length before passing, or the grain will not loop. */
  frame: number;
  width: number;
  height: number;
  seed?: string;
};

export const GrainPass: React.FC<GrainPassProps> = ({
  targetRef,
  frame,
  width,
  height,
  seed = "grain",
}) => {
  useLayoutEffect(() => {
    const ctx = targetRef.current?.getContext("2d");
    if (!ctx) return;
    let state = (Math.floor(random(`${seed}:${frame}`) * 0x7fffffff) | 0) || 1;
    const image = ctx.createImageData(width, height);
    const data = image.data;
    for (let i = 0; i < data.length; i += 4) {
      state ^= state << 13;
      state ^= state >>> 17;
      state ^= state << 5;
      const level = (state >>> 24) & 0xff;
      data[i] = level;
      data[i + 1] = level;
      data[i + 2] = level;
      data[i + 3] = 255;
    }
    ctx.putImageData(image, 0, 0);
  });
  return null;
};

/**
 * Style the grain canvas with this. Keep the canvas backing store at the
 * reduced size and let CSS stretch it; `overlay` at a few percent reads as
 * texture rather than noise.
 */
export const grainLayerStyle = (alpha: number): React.CSSProperties => ({
  position: "absolute",
  inset: 0,
  width: "100%",
  height: "100%",
  display: "block",
  mixBlendMode: "overlay",
  opacity: alpha,
});
