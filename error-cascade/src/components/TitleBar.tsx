/**
 * The title bar: a flat solid band across the top of the dialog, a short label
 * in small type at the left, and a bare close glyph at the right.
 *
 * Deliberately generic. No gradient, no platform button cluster, no system
 * iconography — this must not read as any real operating system.
 */

import type { DialogStyle, Palette } from "../config";
import { FONT_FAMILY } from "../fonts";

export interface TitleBarProps {
  ctx: CanvasRenderingContext2D;
  style: DialogStyle;
  palette: Palette;
  label: string;
  /** Top-left corner of the dialog's inner area within the sprite canvas. */
  x: number;
  y: number;
  width: number;
  height: number;
}

export const drawTitleBar = ({
  ctx,
  style,
  palette,
  label,
  x,
  y,
  width,
  height,
}: TitleBarProps) => {
  ctx.fillStyle = palette.titleBar;
  ctx.fillRect(x, y, width, height);

  ctx.fillStyle = palette.titleText;
  ctx.font = `600 ${style.titleFontSize}px "${FONT_FAMILY}", sans-serif`;
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillText(label, x + style.paddingX * 0.55, y + height / 2 + 0.5);

  // Close glyph: a plain x, no styled box around it.
  const arm = height * 0.19;
  const cx = x + width - height * 0.62;
  const cy = y + height / 2;
  ctx.strokeStyle = palette.titleText;
  ctx.lineWidth = 1.6;
  ctx.lineCap = "butt";
  ctx.beginPath();
  ctx.moveTo(cx - arm, cy - arm);
  ctx.lineTo(cx + arm, cy + arm);
  ctx.moveTo(cx + arm, cy - arm);
  ctx.lineTo(cx - arm, cy + arm);
  ctx.stroke();
};
