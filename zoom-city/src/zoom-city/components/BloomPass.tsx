/**
 * Bloom over the field.
 *
 * The field buffer is reused again here — downscaled hard, blurred, and added
 * back on top. Because the field is drawn additively, the dim streaks
 * contribute almost nothing to the blurred copy and the brightest ones halo,
 * which is the behaviour wanted without a separate threshold pass.
 */

import React, { useCallback } from "react";
import { CanvasLayer } from "../CanvasLayer";
import { HEIGHT, WIDTH } from "../geometry";
import { scratch } from "../scratch";

const DOWNSCALE = 6;

export const BloomPass: React.FC<{
  z: number;
  sourceRef: React.RefObject<HTMLCanvasElement | null>;
  strength: number;
}> = ({ z, sourceRef, strength }) => {
  const draw = useCallback(
    (ctx: CanvasRenderingContext2D) => {
      const field = sourceRef.current;
      if (!field) {
        return;
      }
      const sw = Math.round(WIDTH / DOWNSCALE);
      const sh = Math.round(HEIGHT / DOWNSCALE);
      const small = scratch("bloom", sw, sh);
      const sctx = small.getContext("2d");
      if (!sctx) {
        return;
      }
      sctx.filter = "blur(9px)";
      sctx.drawImage(field, 0, 0, sw, sh);
      sctx.filter = "none";

      ctx.globalAlpha = strength;
      ctx.drawImage(small, 0, 0, WIDTH, HEIGHT);
      ctx.globalAlpha = 1;
    },
    [sourceRef, strength],
  );

  return <CanvasLayer z={z} draw={draw} blend="screen" />;
};
