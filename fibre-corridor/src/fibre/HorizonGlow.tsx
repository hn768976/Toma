import React, { useLayoutEffect } from "react";
import { HEIGHT, WIDTH } from "./constants";
import { mixHex, parseHex } from "./color";
import { radialBlob } from "./draw";
import { TAU } from "./geometry";
import type { Scene } from "./scene";

/** Three pulses over 375 frames — a period of 125, an exact divisor. */
const PULSE_CYCLES = 3;

/**
 * The bloom the corridor recedes into. Pulses +-8% on a sine whose period
 * divides the loop.
 */
export const HorizonGlow: React.FC<{ scene: Scene }> = ({ scene }) => {
  useLayoutEffect(() => {
    const { main: ctx, variant, vpx, vpy, camX, camY, p } = scene;
    const glow = parseHex(variant.palette.horizonGlow);
    const hot = mixHex(variant.palette.horizonGlow, variant.palette.strandWhite, 0.7);

    const pulse = 1 + 0.08 * Math.sin(TAU * PULSE_CYCLES * p);
    const x = vpx + camX;
    const y = vpy + camY;

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.filter = "none";
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "lighter";

    radialBlob(ctx, x, y, WIDTH * 0.34 * pulse, glow, glow, 0.17, 0.25);
    radialBlob(ctx, x, y, WIDTH * 0.13 * pulse, hot, glow, 0.24, 0.30);
    radialBlob(ctx, x, y, HEIGHT * 0.035 * pulse, hot, hot, 0.46, 0.35);

    ctx.globalCompositeOperation = "source-over";
  });

  return null;
};
