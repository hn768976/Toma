/**
 * The error icon: a filled circle with an x struck through it. Invented, not
 * borrowed from any platform's icon set.
 */

import type { DialogStyle, Palette } from "../config";

export interface ErrorIconProps {
  ctx: CanvasRenderingContext2D;
  style: DialogStyle;
  palette: Palette;
  cx: number;
  cy: number;
}

export const drawErrorIcon = ({ ctx, style, palette, cx, cy }: ErrorIconProps) => {
  const r = style.iconRadius;

  ctx.fillStyle = palette.iconCircle;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();

  const arm = r * 0.42;
  ctx.strokeStyle = palette.iconGlyph;
  ctx.lineWidth = r * 0.2;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(cx - arm, cy - arm);
  ctx.lineTo(cx + arm, cy + arm);
  ctx.moveTo(cx + arm, cy - arm);
  ctx.lineTo(cx - arm, cy + arm);
  ctx.stroke();
};
