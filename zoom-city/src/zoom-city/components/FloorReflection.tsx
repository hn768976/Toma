/**
 * The floor.
 *
 * The reflection is the field buffer drawn again, mirrored about the horizon,
 * blurred and knocked back — never a second pass over the streaks. On the
 * "wet" floor it is stacked in three copies of increasing vertical stretch so
 * the light smears downward the way it does on wet asphalt; on the "dry" floor
 * the smear is dropped and the blur raised until it is only a soft glow.
 *
 * Whatever the mode, the reflection fades to nothing before the bottom of the
 * frame, and a brighter band sits on the horizon defining the meeting.
 */

import React, { useCallback } from "react";
import { CanvasLayer } from "../CanvasLayer";
import { hexToRgb, rgba, shadow } from "../colour";
import { HEIGHT, WIDTH, type Scene } from "../geometry";
import { scratch } from "../scratch";
import type { Variant } from "../variants";

/** The reflection is blurred anyway, so it is built at a third resolution. */
const DOWNSCALE = 3;

export const FloorReflection: React.FC<{
  variant: Variant;
  scene: Scene;
  z: number;
  sourceRef: React.RefObject<HTMLCanvasElement | null>;
}> = ({ variant, scene, z, sourceRef }) => {
  const draw = useCallback(
    (ctx: CanvasRenderingContext2D) => {
      const field = sourceRef.current;
      if (!field) {
        return;
      }
      const floor = variant.floor;
      const tint = hexToRgb(variant.palette.floorTint);
      const glow = hexToRgb(variant.palette.horizonGlow);
      const horizon = scene.horizonY;

      // --- blurred, downscaled copy of the field ----------------------
      const sw = Math.round(WIDTH / DOWNSCALE);
      const sh = Math.round(HEIGHT / DOWNSCALE);
      const small = scratch("reflection", sw, sh);
      const sctx = small.getContext("2d");
      if (!sctx) {
        return;
      }
      sctx.filter = `blur(${(floor.blur / DOWNSCALE).toFixed(2)}px)`;
      sctx.drawImage(field, 0, 0, sw, sh);
      sctx.filter = "none";

      // --- mirrored, stretched copies ---------------------------------
      const copies =
        floor.mode === "wet"
          ? [
              { smear: 1, alpha: 0.85 },
              { smear: floor.smear, alpha: 0.3 },
              { smear: floor.smear * 1.55, alpha: 0.14 },
            ]
          : [{ smear: 1, alpha: 1 }];

      ctx.save();
      ctx.beginPath();
      ctx.rect(0, horizon, WIDTH, HEIGHT - horizon);
      ctx.clip();
      ctx.globalCompositeOperation = "lighter";
      for (const copy of copies) {
        ctx.save();
        ctx.translate(0, horizon);
        ctx.scale(1, -copy.smear);
        ctx.translate(0, -horizon);
        ctx.globalAlpha = floor.opacity * copy.alpha;
        ctx.drawImage(small, 0, 0, WIDTH, HEIGHT);
        ctx.restore();
      }
      ctx.globalAlpha = 1;

      // Tint the reflection towards the floor colour so it reads as a
      // surface picking the light up rather than as a second sky.
      ctx.globalCompositeOperation = "source-atop";
      ctx.fillStyle = rgba(tint, 0.18);
      ctx.fillRect(0, horizon, WIDTH, HEIGHT - horizon);
      ctx.restore();

      // --- fade out with distance below the horizon -------------------
      const fade = ctx.createLinearGradient(0, horizon, 0, HEIGHT);
      fade.addColorStop(0, shadow(0));
      fade.addColorStop(0.5, shadow(0.5));
      fade.addColorStop(1, shadow(1));
      ctx.globalCompositeOperation = "destination-out";
      ctx.fillStyle = fade;
      ctx.fillRect(0, horizon, WIDTH, HEIGHT - horizon);
      ctx.globalCompositeOperation = "source-over";

      // --- the horizon band -------------------------------------------
      // Drawn as two very flat ellipses centred on the vanishing point, so it
      // is brightest where the field converges and dies away towards the
      // frame edges without needing a second erase pass.
      const bandScale = floor.horizonBand;
      const flatGlow = (halfWidth: number, halfHeight: number, alpha: number) => {
        ctx.save();
        ctx.translate(scene.vx, horizon);
        ctx.scale(halfWidth, halfHeight);
        const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
        g.addColorStop(0, rgba(glow, alpha));
        g.addColorStop(0.35, rgba(glow, alpha * 0.45));
        g.addColorStop(1, rgba(glow, 0));
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(0, 0, 1, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      };
      ctx.globalCompositeOperation = "lighter";
      flatGlow(WIDTH * 0.62, 150 * bandScale, 0.34 * bandScale);
      flatGlow(WIDTH * 0.42, 34 * bandScale, 0.7 * bandScale);
      flatGlow(WIDTH * 0.2, 10 * bandScale, 0.85 * bandScale);
      ctx.globalCompositeOperation = "source-over";
    },
    [variant, scene, sourceRef],
  );

  return <CanvasLayer z={z} draw={draw} />;
};
