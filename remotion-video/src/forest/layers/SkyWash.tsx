import React from "react";
import { LayerCanvas } from "../useLayerCanvas";
import { mixHex, withAlpha } from "../color";
import type { Palette } from "../variants";

/**
 * The static backdrop: a vertical wash from a near-black top, through the
 * upper haze, to a faintly lifted band at the horizon where the fog sits, and
 * back down into the dark ground.
 *
 * Pure gradient, so it is computed into a tiny backing store and upscaled —
 * there is no detail here to lose.
 */
export const SkyWash: React.FC<{ palette: Palette }> = ({ palette }) => {
  const draw = (ctx: CanvasRenderingContext2D, w: number, h: number) => {
    const sky = ctx.createLinearGradient(0, 0, 0, h);
    sky.addColorStop(0, palette.skyDeep);
    sky.addColorStop(0.28, mixHex(palette.skyDeep, palette.skyMid, 0.75));
    sky.addColorStop(0.44, palette.skyMid);
    // The horizon lift: the brightest part of the sky sits just above the
    // tree line, which is what reads as "light behind the forest".
    sky.addColorStop(0.6, mixHex(palette.skyMid, palette.fogPale, 0.34));
    sky.addColorStop(0.78, mixHex(palette.skyDeep, palette.groundDark, 0.5));
    sky.addColorStop(1, palette.groundDark);
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, w, h);

    // A very soft off-centre brightening, so the wash is not perfectly
    // symmetrical and the eye has somewhere to settle.
    const glow = ctx.createRadialGradient(
      w * 0.62,
      h * 0.56,
      0,
      w * 0.62,
      h * 0.56,
      w * 0.5,
    );
    glow.addColorStop(0, withAlpha(palette.fogPale, 0.1));
    glow.addColorStop(1, withAlpha(palette.fogPale, 0));
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, w, h);
  };

  return <LayerCanvas width={480} height={270} draw={draw} />;
};
