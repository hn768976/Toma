/** A vertical measurement rule with tick marks down the right edge. */
import React from "react";
import { monoFont } from "../fonts";
import { useOffscreen, withAlpha } from "../shared/draw";
import type { Palette } from "../variants";

export const MeasureRule: React.FC<{
  x: number;
  y: number;
  height: number;
  palette: Palette;
}> = ({ x, y, height, palette }) => {
  const w = 86;
  const canvas = useOffscreen(
    w,
    height,
    (ctx) => {
      ctx.strokeStyle = withAlpha(palette.panelBorder, 0.95);
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(2, 0);
      ctx.lineTo(2, height);
      ctx.stroke();

      const step = 26;
      const n = Math.floor(height / step);
      ctx.font = monoFont(17);
      ctx.textBaseline = "middle";
      for (let i = 0; i <= n; i++) {
        const ty = i * step;
        const major = i % 5 === 0;
        ctx.strokeStyle = withAlpha(palette.panelBorder, major ? 1 : 0.6);
        ctx.lineWidth = major ? 2.5 : 2;
        ctx.beginPath();
        ctx.moveTo(2, ty);
        ctx.lineTo(2 + (major ? 26 : 14), ty);
        ctx.stroke();
        if (i % 10 === 0) {
          ctx.fillStyle = withAlpha(palette.textPale, 0.85);
          ctx.fillText(String(i * 4).padStart(3, "0"), 36, ty);
        }
      }
    },
    [w, height, palette],
  );

  return (
    <canvas
      ref={(el) => {
        if (el) el.getContext("2d")!.drawImage(canvas, 0, 0);
      }}
      width={w}
      height={height}
      style={{ position: "absolute", left: x, top: y, width: w, height }}
    />
  );
};
