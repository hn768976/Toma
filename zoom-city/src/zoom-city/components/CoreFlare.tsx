/**
 * The flare at the vanishing point.
 *
 * A small near-white core with layered radial gradients around it, plus — in
 * the versions that have a horizon — a wide, very flat anamorphic streak. That
 * horizontal bar is what makes the point read as a light source rather than as
 * a bright dot. Without a horizon it reads as an unexplained artefact, so the
 * "mono" version replaces it with a symmetrical glow instead.
 *
 * The whole flare pulses ±12% on a sine whose period divides the loop.
 */

import React, { useCallback } from "react";
import { CanvasLayer } from "../CanvasLayer";
import { hexToRgb, rgba } from "../colour";
import { LOOP_FRAMES, type Scene } from "../geometry";
import type { Variant } from "../variants";

/** 150 frames: two pulses across the 300-frame loop, so it closes. */
const PULSE_PERIOD = LOOP_FRAMES / 2;

export const CoreFlare: React.FC<{
  variant: Variant;
  scene: Scene;
  z: number;
}> = ({ variant, scene, z }) => {
  const draw = useCallback(
    (ctx: CanvasRenderingContext2D) => {
      const core = hexToRgb(variant.palette.coreWhite);
      const glow = hexToRgb(variant.palette.horizonGlow);
      const pulse =
        1 + 0.12 * Math.sin((scene.f / PULSE_PERIOD) * Math.PI * 2);
      const scale = variant.core.scale * pulse;

      ctx.globalCompositeOperation = "lighter";
      ctx.translate(scene.vx, scene.vy);

      const halo = (radius: number, colour: readonly [number, number, number], alpha: number, stretchX = 1, stretchY = 1) => {
        ctx.save();
        ctx.scale(radius * stretchX, radius * stretchY);
        const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
        g.addColorStop(0, rgba(colour, alpha));
        g.addColorStop(0.22, rgba(colour, alpha * 0.42));
        g.addColorStop(0.55, rgba(colour, alpha * 0.12));
        g.addColorStop(1, rgba(colour, 0));
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(0, 0, 1, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      };

      // Layered radial gradients, widest and faintest first.
      halo(880 * scale, glow, 0.22);
      halo(390 * scale, glow, 0.34);
      halo(170 * scale, core, 0.55);
      halo(70 * scale, core, 0.92);

      if (variant.core.anamorphic) {
        // Several times wider than tall, at low alpha.
        halo(1500 * scale, core, 0.2, 1, 0.055);
        halo(900 * scale, glow, 0.24, 1, 0.11);
      } else {
        // No horizon to explain a horizontal bar: keep it symmetrical.
        halo(1750 * scale, glow, 0.16);
        halo(700 * scale, core, 0.2);
      }

      // The hot centre itself.
      const hot = ctx.createRadialGradient(0, 0, 0, 0, 0, 32 * scale);
      hot.addColorStop(0, rgba(core, 1));
      hot.addColorStop(0.55, rgba(core, 0.75));
      hot.addColorStop(1, rgba(core, 0));
      ctx.fillStyle = hot;
      ctx.beginPath();
      ctx.arc(0, 0, 32 * scale, 0, Math.PI * 2);
      ctx.fill();

      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.globalCompositeOperation = "source-over";
    },
    [variant, scene],
  );

  return <CanvasLayer z={z} draw={draw} blend="screen" />;
};
