/**
 * Bursts.
 *
 * The streaks inside a burst sector are brightened inside the field itself
 * (see burstGain), so the burst survives into the reflection. This layer adds
 * what that cannot: the wedge of haze that a cluster of headlights throws
 * across the air around it.
 */

import React, { useCallback } from "react";
import { CanvasLayer } from "../CanvasLayer";
import { angularMap } from "../angular";
import { activeBursts } from "../bursts";
import { hexToRgb, rgba } from "../colour";
import { HEIGHT, WIDTH, type Scene } from "../geometry";
import { scratch } from "../scratch";
import type { Variant } from "../variants";

/** The haze is built small and blurred, so its wedge has no hard edge. */
const DOWNSCALE = 6;

export const BurstLayer: React.FC<{
  variant: Variant;
  scene: Scene;
  z: number;
  clipBelow?: number;
}> = ({ variant, scene, z, clipBelow }) => {
  const draw = useCallback(
    (ctx: CanvasRenderingContext2D) => {
      const active = activeBursts(variant, scene.f);
      if (active.length === 0) {
        return;
      }
      const map = angularMap(variant);
      const glow = hexToRgb(variant.palette.streakWhite);

      const sw = Math.round(WIDTH / DOWNSCALE);
      const sh = Math.round(HEIGHT / DOWNSCALE);
      const small = scratch("burst", sw, sh);
      const hctx = small.getContext("2d");
      if (!hctx) {
        return;
      }
      const k = 1 / DOWNSCALE;
      const vx = scene.vx * k;
      const vy = scene.vy * k;
      hctx.globalCompositeOperation = "lighter";
      hctx.filter = "blur(11px)";
      for (const { burst, intensity } of active) {
        const a0 = map.angleAt(burst.seedStart) + scene.rotation;
        let a1 = map.angleAt(burst.seedStart + burst.seedWidth) + scene.rotation;
        if (a1 < a0) {
          a1 += Math.PI * 2;
        }
        // A very wide sector means the window wrapped the whole circle; skip
        // the haze there rather than washing the entire frame.
        if (a1 - a0 > Math.PI) {
          continue;
        }
        const pad = (a1 - a0) * 0.3 + 0.02;
        const r = scene.maxRadius * 1.05 * k;

        const grad = hctx.createRadialGradient(vx, vy, 0, vx, vy, r);
        const a = 0.2 * intensity;
        grad.addColorStop(0, rgba(glow, a * 0.9));
        grad.addColorStop(0.25, rgba(glow, a * 0.5));
        grad.addColorStop(0.7, rgba(glow, a * 0.14));
        grad.addColorStop(1, rgba(glow, 0));
        hctx.fillStyle = grad;

        hctx.beginPath();
        hctx.moveTo(vx, vy);
        hctx.arc(vx, vy, r, a0 - pad, a1 + pad);
        hctx.closePath();
        hctx.fill();
      }
      hctx.filter = "none";
      hctx.globalCompositeOperation = "source-over";
      ctx.drawImage(small, 0, 0, WIDTH, HEIGHT);
    },
    [variant, scene],
  );

  return <CanvasLayer z={z} draw={draw} blend="screen" clipBelow={clipBelow} />;
};
