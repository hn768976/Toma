import React, { useMemo } from "react";
import { makeSprite, useCanvasDraw } from "@lib/canvas/canvas";
import { FRAME_H, FRAME_W } from "../layout";
import { GRAIN_TILE_COUNT } from "../timing";
import { grainPass, makeGrainTiles, scanlinePass, vignettePass } from "@lib/effects/finish";

const TILE = 256;
const GRAIN_ALPHA = 0.04;
const SCANLINE_STEP = 5;
const SCANLINE_ALPHA = 0.03;

/**
 * The finishing pass: scanlines, vignette and grain, over the whole 3840x2160
 * frame.
 *
 * Scanlines and vignette never change, so they are rasterised once into a
 * single sprite and blitted. Only the grain is per-frame, and it is a small
 * pre-rolled tile fill rather than a full-frame noise buffer — generating
 * 8.3 million seeded random numbers per frame would dominate the render.
 * Which tile, and where it is offset, is seeded from the wrapped frame, so the
 * grain is deterministic and repeats exactly on the loop.
 */
export const Overlay: React.FC<{ frame: number }> = ({ frame }) => {
  const staticLayer = useMemo(
    () =>
      makeSprite(FRAME_W, FRAME_H, (ctx) => {
        scanlinePass(ctx, {
          width: FRAME_W,
          height: FRAME_H,
          step: SCANLINE_STEP,
          alpha: SCANLINE_ALPHA,
        });
        vignettePass(ctx, { width: FRAME_W, height: FRAME_H });
      }),
    [],
  );

  const tiles = useMemo(() => makeGrainTiles(GRAIN_TILE_COUNT, TILE), []);

  const ref = useCanvasDraw(FRAME_W, FRAME_H, (ctx) => {
    if (staticLayer) ctx.drawImage(staticLayer, 0, 0);
    grainPass(ctx, {
      width: FRAME_W,
      height: FRAME_H,
      tiles,
      frame,
      alpha: GRAIN_ALPHA,
    });
  });

  return (
    <canvas
      ref={ref}
      width={FRAME_W}
      height={FRAME_H}
      style={{
        position: "absolute",
        left: 0,
        top: 0,
        width: FRAME_W,
        height: FRAME_H,
        pointerEvents: "none",
      }}
    />
  );
};
