import React from "react";
import { useCanvasDraw } from "@lib/canvas/canvas";
import { LAYOUT } from "../layout";
import { PALETTE, withAlpha } from "../palette";
import { sansFont } from "../fonts";
import { smallCaps } from "@lib/draw/panel-chrome";

/** The bottom-right ID label — the only text in the frame that differs
 *  between the three versions. */
export const IdLabel: React.FC<{ id: string }> = ({ id }) => {
  const r = LAYOUT.idLabel;
  const ref = useCanvasDraw(r.w, r.h, (ctx) => {
    smallCaps(ctx, id, r.w, 96, {
      font: sansFont(600, 84),
      color: PALETTE.textBright,
      align: "right",
      spacing: "6px",
    });
    ctx.strokeStyle = withAlpha(PALETTE.elementDim, 0.9);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(r.w - 250, 132);
    ctx.lineTo(r.w, 132);
    ctx.stroke();
    smallCaps(ctx, "unit id", r.w, 160, {
      font: sansFont(500, 24),
      color: withAlpha(PALETTE.textPale, 0.85),
      align: "right",
    });
  });
  return (
    <canvas
      ref={ref}
      width={r.w}
      height={r.h}
      style={{ position: "absolute", left: r.x, top: r.y, width: r.w, height: r.h }}
    />
  );
};
