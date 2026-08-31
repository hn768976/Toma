import React from "react";
import { CanvasLayer } from "./CanvasLayer";
import { fontString, SANS } from "../fonts";
import type { Layout } from "../layout";
import { PROMPT_CHEVRON } from "../variants";

export type IconKind = "magnifier" | "chevron";

/**
 * A circle with a short diagonal handle at its lower right, drawn as a stroke
 * rather than a filled glyph. Exported on its own because the autocomplete
 * rows draw the same mark at a much smaller size.
 */
export const drawMagnifier = (
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number,
  lineWidth: number,
  color: string,
) => {
  const ringCx = cx - r * 0.16;
  const ringCy = cy - r * 0.16;
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = lineWidth;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.arc(ringCx, ringCy, r, 0, Math.PI * 2);
  ctx.stroke();
  const diag = Math.SQRT1_2;
  ctx.beginPath();
  ctx.moveTo(ringCx + r * diag, ringCy + r * diag);
  ctx.lineTo(ringCx + r * diag * 2.05, ringCy + r * diag * 2.05);
  ctx.stroke();
  ctx.restore();
};

/** The terminal version's prompt mark, sitting in the magnifier's slot. */
export const drawChevron = (
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number,
  color: string,
) => {
  ctx.save();
  ctx.fillStyle = color;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = fontString(700, r * 2.6, SANS);
  ctx.fillText(PROMPT_CHEVRON, cx, cy);
  ctx.restore();
};

/**
 * Chrome: it never changes across the cycle, so it owns a canvas that is drawn
 * once and then left alone (the memo below stops it re-rendering with the
 * frame).
 */
export const MagnifierIcon: React.FC<{
  layout: Layout;
  color: string;
  kind: IconKind;
}> = React.memo(({ layout, color, kind }) => {
  const box = layout.iconR * 4;
  return (
    <CanvasLayer
      x={layout.iconCx - box / 2}
      y={layout.iconCy - box / 2}
      width={Math.ceil(box)}
      height={Math.ceil(box)}
      draw={(ctx) => {
        if (kind === "chevron") {
          drawChevron(ctx, layout.iconCx, layout.iconCy, layout.iconR, color);
          return;
        }
        drawMagnifier(
          ctx,
          layout.iconCx,
          layout.iconCy,
          layout.iconR,
          layout.iconStroke,
          color,
        );
      }}
    />
  );
});
MagnifierIcon.displayName = "MagnifierIcon";
