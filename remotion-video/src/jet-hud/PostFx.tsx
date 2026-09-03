import React, { useLayoutEffect } from "react";
import type { Surfaces } from "./surfaces";
import { DURATION_IN_FRAMES, HEIGHT, WIDTH } from "./constants";
import { rndInt } from "../lib/seeded";
import {
  bloomPass,
  grainPass,
  scanlinePass,
  vignettePass,
} from "../lib/postFx";
import type { Variant } from "./variants";

/**
 * The finish pass: bloom, vignette, scanlines, grain — in that order, once
 * per frame, over the assembled image.
 *
 * The whole sequence runs inside one save/reset of the canvas transform.
 * The library passes each reset it too, but doing it here as well keeps the
 * four of them operating on exactly the same footing regardless of what the
 * layers before them left behind.
 */
export const PostFx: React.FC<{
  variant: Variant;
  frame: number;
  surfaces: Surfaces;
  target: React.RefObject<HTMLCanvasElement | null>;
}> = ({ variant, frame, surfaces, target }) => {
  useLayoutEffect(() => {
    const ctx = target.current?.getContext("2d");
    if (!ctx) return;
    const p = variant.palette;
    const size = { width: WIDTH, height: HEIGHT };

    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);

    // Only the exhaust and the brightest HUD elements were written into the
    // glow accumulator; the airframe deliberately is not, so it stays a solid
    // object rather than a light source.
    bloomPass(ctx, surfaces.glow, size);
    vignettePass(ctx, { ...size, color: p.bgDeep, strength: 0.2, mid: 0.08 });
    scanlinePass(ctx, surfaces.scanlines, size);

    // Grain tile and offset are both functions of frame % 390, and 390 is
    // divisible by the tile count, so the last frame of the loop is grained
    // identically to the first.
    const f =
      ((frame % DURATION_IN_FRAMES) + DURATION_IN_FRAMES) % DURATION_IN_FRAMES;
    grainPass(ctx, surfaces.grainTiles[f % surfaces.grainTiles.length], {
      ...size,
      alpha: 0.04,
      offsetX: rndInt(`grain:x:${f}`, 0, 512),
      offsetY: rndInt(`grain:y:${f}`, 0, 512),
    });

    ctx.restore();
  });

  return null;
};
