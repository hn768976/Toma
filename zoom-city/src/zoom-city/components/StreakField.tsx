/**
 * The field itself — ~900 tapered streaks radiating from the vanishing point.
 *
 * This canvas *is* the shared buffer: the reflection and the bloom pass both
 * read it back with drawImage instead of redrawing the field, which is the
 * main optimisation available here — it halves (in practice, thirds) the
 * per-frame cost.
 */

import React, { useCallback } from "react";
import { CanvasLayer } from "../CanvasLayer";
import { activeBursts, burstGain } from "../bursts";
import type { Scene } from "../geometry";
import { buildStreaks, drawStreak, streakStateAt } from "../streaks";
import type { Variant } from "../variants";

export const StreakField: React.FC<{
  variant: Variant;
  scene: Scene;
  z: number;
  /** The field canvas, handed on to the layers that reuse it. */
  bufferRef: React.RefObject<HTMLCanvasElement | null>;
  /** Cut the field at the horizon when there is a floor beneath it. */
  clipBelow?: number;
}> = ({ variant, scene, z, bufferRef, clipBelow }) => {
  const draw = useCallback(
    (ctx: CanvasRenderingContext2D) => {
      const streaks = buildStreaks(variant);
      const active = activeBursts(variant, scene.f);

      // Additive: overlapping streaks accumulate into light, which is what
      // makes the dense fans read as glow rather than as stacked paint.
      ctx.globalCompositeOperation = "lighter";
      for (const s of streaks) {
        const st = streakStateAt(s, scene, variant);
        drawStreak(ctx, s, st, scene, burstGain(active, st.angleSeed));
      }
      ctx.globalCompositeOperation = "source-over";
    },
    [variant, scene],
  );

  return (
    <CanvasLayer z={z} draw={draw} canvasRef={bufferRef} clipBelow={clipBelow} />
  );
};
