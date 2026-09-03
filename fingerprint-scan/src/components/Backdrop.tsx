/**
 * The static ground: deep background with a wash, plus the marginal marks —
 * short dashed rules and small crosshairs. Nothing here changes, so it is drawn
 * once into an offscreen canvas and blitted.
 */
import React from "react";
import { crosshair, irregularDashes, useOffscreen, withAlpha } from "../lib/draw";
import { CROSSHAIRS, DASHED_RULES, H, PRINT_CX, PRINT_CY, W } from "../layout";
import type { Palette } from "../variants";

export const Backdrop: React.FC<{ palette: Palette }> = ({ palette }) => {
  const canvas = useOffscreen(
    W,
    H,
    (ctx) => {
      ctx.fillStyle = palette.bgDeep;
      ctx.fillRect(0, 0, W, H);

      // A wash centred behind the subject, falling off to the deep ground.
      const g = ctx.createRadialGradient(PRINT_CX, PRINT_CY, 0, PRINT_CX, PRINT_CY, W * 0.62);
      g.addColorStop(0, withAlpha(palette.bgWash, 0.95));
      g.addColorStop(0.55, withAlpha(palette.bgWash, 0.34));
      g.addColorStop(1, withAlpha(palette.bgWash, 0));
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);

      for (const d of DASHED_RULES) {
        irregularDashes(ctx, d.x, d.y, d.w, d.seed, withAlpha(palette.panelBorder, 0.8), 3);
      }
      for (const c of CROSSHAIRS) {
        crosshair(ctx, c.x, c.y, withAlpha(palette.panelBorder, 0.9), 20);
      }
    },
    [palette],
  );

  return (
    <canvas
      ref={(el) => {
        if (el) el.getContext("2d")!.drawImage(canvas, 0, 0);
      }}
      width={W}
      height={H}
      style={{ position: "absolute", left: 0, top: 0, width: W, height: H }}
    />
  );
};
