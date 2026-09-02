import React from "react";
import { LayerCanvas } from "../../lib/useLayerCanvas";
import { hexToRgb, mixHex, mixRgb, rgbToCss, withAlpha } from "../../lib/color";
import type { Palette, SkySettings } from "../variants";

/**
 * The static backdrop: a vertical wash from a near-black top, through the
 * upper haze, to a lifted band at the horizon where the fog sits, and back
 * down into the dark ground.
 *
 * `sky.horizonWarm` decides where the light in the frame appears to come
 * from. At 0 the horizon lifts toward the neutral haze colour and the scene
 * reads as dusk; pushed toward `groundGlow` it reads as a sky lit from below
 * by whatever is burning on the ground, which is what makes a night fire a
 * night fire rather than a dark grey evening.
 *
 * Pure gradient, so it is computed into a tiny backing store and upscaled —
 * there is no detail here to lose.
 */
export const SkyWash: React.FC<{ palette: Palette; sky: SkySettings }> = ({
  palette,
  sky,
}) => {
  const draw = (ctx: CanvasRenderingContext2D, w: number, h: number) => {
    // Composed in RGB, not by nesting mixHex — mixHex returns an rgba()
    // string, which cannot be fed back into another colour mix.
    const horizon = rgbToCss(
      mixRgb(
        mixRgb(
          hexToRgb(palette.skyMid),
          hexToRgb(palette.fogPale),
          sky.horizonLift,
        ),
        hexToRgb(palette.groundGlow),
        sky.horizonWarm * sky.horizonLift,
      ),
    );

    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, palette.skyDeep);
    grad.addColorStop(0.28, mixHex(palette.skyDeep, palette.skyMid, 0.75));
    grad.addColorStop(0.44, palette.skyMid);
    // The horizon lift: the brightest part of the sky sits just above the tree
    // line, which is what reads as "light behind the forest".
    grad.addColorStop(0.6, horizon);
    grad.addColorStop(0.78, mixHex(palette.skyDeep, palette.groundDark, 0.5));
    grad.addColorStop(1, palette.groundDark);
    ctx.fillStyle = grad;
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
    glow.addColorStop(0, withAlpha(palette.fogPale, sky.glowAlpha));
    glow.addColorStop(1, withAlpha(palette.fogPale, 0));
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, w, h);
  };

  return <LayerCanvas width={480} height={270} draw={draw} />;
};
