/**
 * <BackgroundWash> — the ground the whole frame sits on.
 *
 * A near-black field with a warmer wash pooled behind the subject and a
 * fainter one low and left, so the frame is never flat and the brain has
 * something to separate from. Drawn into a quarter-size buffer: a
 * gradient this soft gains nothing from 8 million pixels, and the upscale
 * smooths the banding a full-resolution gradient would show.
 */
import React from "react";
import { DrawCanvas } from "../../lib/DrawCanvas";
import { withAlpha, type Theme } from "../theme";
import { BACKGROUND_SCALE, HEIGHT, WIDTH } from "../config";

export const BackgroundWash: React.FC<{
  theme: Theme;
  centerX: number;
  centerY: number;
}> = ({ theme, centerX, centerY }) => {
  const w = Math.round(WIDTH * BACKGROUND_SCALE);
  const h = Math.round(HEIGHT * BACKGROUND_SCALE);
  return (
    <DrawCanvas
      width={w}
      height={h}
      draw={(ctx) => {
        ctx.fillStyle = theme.backgroundDeep;
        ctx.fillRect(0, 0, w, h);

        const cx = centerX * BACKGROUND_SCALE;
        const cy = centerY * BACKGROUND_SCALE;
        const main = ctx.createRadialGradient(cx, cy, 0, cx, cy, w * 0.52);
        main.addColorStop(0, withAlpha(theme.backgroundWash, 1));
        main.addColorStop(0.45, withAlpha(theme.backgroundWash, 0.44));
        main.addColorStop(1, withAlpha(theme.backgroundWash, 0));
        ctx.fillStyle = main;
        ctx.fillRect(0, 0, w, h);

        const lx = w * 0.16;
        const ly = h * 0.82;
        const low = ctx.createRadialGradient(lx, ly, 0, lx, ly, w * 0.36);
        low.addColorStop(0, withAlpha(theme.backgroundWash, 0.3));
        low.addColorStop(1, withAlpha(theme.backgroundWash, 0));
        ctx.fillStyle = low;
        ctx.fillRect(0, 0, w, h);
      }}
    />
  );
};
