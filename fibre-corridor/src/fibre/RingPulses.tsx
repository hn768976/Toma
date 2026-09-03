import React, { useLayoutEffect } from "react";
import { HEIGHT, WIDTH } from "./constants";
import { mixHex, rgba } from "./color";
import { clamp, TAU } from "./geometry";
import type { Scene } from "./scene";

const RINGS = 4;
/** Three passes over 375 frames — a period of 125, an exact divisor. */
const CYCLES = 3;

/**
 * Thin cross-sections expanding from the vanishing point toward the camera,
 * on the tube's own perspective (radius scales with d², like the lanes).
 * They give an otherwise open tube a readable enclosure.
 */
export const RingPulses: React.FC<{ scene: Scene }> = ({ scene }) => {
  useLayoutEffect(() => {
    const { main: ctx, variant, vpx, vpy, camX, camY, p } = scene;
    if (!variant.ringPulses) return;

    const col = mixHex(variant.palette.strandPale, variant.palette.horizonGlow, 0.5);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.filter = "none";
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "lighter";

    for (let i = 0; i < RINGS; i++) {
      const d = (((p * CYCLES + i / RINGS) % 1) + 1) % 1;
      const fade =
        clamp(d / 0.12, 0, 1) * clamp((1 - d) / 0.28, 0, 1);
      if (fade <= 0.004) continue;
      const rx = WIDTH * 0.5 * d * d;
      const ry = HEIGHT * 0.5 * d * d;
      ctx.beginPath();
      ctx.ellipse(vpx + camX, vpy + camY, rx, ry, 0, 0, TAU);
      ctx.strokeStyle = rgba(col, 0.1 * fade);
      ctx.lineWidth = 2 + 9 * d * d;
      ctx.stroke();
      ctx.strokeStyle = rgba(col, 0.055 * fade);
      ctx.lineWidth = 10 + 34 * d * d;
      ctx.stroke();
    }

    ctx.globalCompositeOperation = "source-over";
  });

  return null;
};
