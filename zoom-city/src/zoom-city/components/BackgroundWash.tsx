/**
 * The ground the piece sits on: a near-black base plus a broad wash of light
 * centred on the vanishing point, so the field emerges from something rather
 * than floating on flat black.
 */

import React, { useCallback } from "react";
import { CanvasLayer } from "../CanvasLayer";
import { hexToRgb, rgba } from "../colour";
import { HEIGHT, WIDTH, type Scene } from "../geometry";
import type { Variant } from "../variants";

export const BackgroundWash: React.FC<{
  variant: Variant;
  scene: Scene;
  z: number;
}> = ({ variant, scene, z }) => {
  const draw = useCallback(
    (ctx: CanvasRenderingContext2D) => {
      const deep = hexToRgb(variant.palette.backgroundDeep);
      const wash = hexToRgb(variant.palette.backgroundWash);

      ctx.fillStyle = rgba(deep, 1);
      ctx.fillRect(0, 0, WIDTH, HEIGHT);

      const r = scene.maxRadius * 0.95;
      const grad = ctx.createRadialGradient(
        scene.vx,
        scene.vy,
        0,
        scene.vx,
        scene.vy,
        r,
      );
      grad.addColorStop(0, rgba(wash, 0.7));
      grad.addColorStop(0.18, rgba(wash, 0.32));
      grad.addColorStop(0.45, rgba(wash, 0.12));
      grad.addColorStop(1, rgba(wash, 0));
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, WIDTH, HEIGHT);
    },
    [variant, scene],
  );

  return <CanvasLayer z={z} draw={draw} />;
};
