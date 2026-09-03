/**
 * The one piece of substantial copy in the frame.
 *
 * Shape is entirely variant-driven: v1 gets a small bracketed chrome plate at
 * the lower left, v3 a larger underlined title at the lower right beside the
 * arc cluster, and v2 no plate at all (its centre dial carries the wording).
 * The text itself lives in VARIANTS, never here.
 *
 * Letterspacing is applied by measuring and placing each glyph, so tracking is
 * exact at 4K rather than depending on a CSS property canvas does not have.
 */
import { withAlpha } from "../color";
import { FONT_CONDENSED } from "../fonts";
import { Layer } from "./Layer";
import type { LabelConfig, Palette } from "../variants";

/** Draws `text` from `x` with per-glyph tracking. Returns the total width. */
const trackedText = (
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  tracking: number,
  measureOnly = false,
): number => {
  const widths = [...text].map((ch) => ctx.measureText(ch).width);
  let at = x;
  [...text].forEach((ch, i) => {
    if (!measureOnly) ctx.fillText(ch, at, y);
    at += widths[i] + tracking;
  });
  return at - tracking - x;
};

export type LabelPlateProps = {
  label: LabelConfig;
  palette: Palette;
  width: number;
  height: number;
};

export const LabelPlate: React.FC<LabelPlateProps> = ({
  label,
  palette,
  width,
  height,
}) => {
  const draw = (ctx: CanvasRenderingContext2D) => {
    const text = label.text.toUpperCase();
    const tracking = Math.max(3, label.size * 0.14);
    const margin = 128;

    ctx.font = `500 ${label.size}px "${FONT_CONDENSED}"`;
    ctx.textBaseline = "alphabetic";
    ctx.textAlign = "left";

    const textWidth = trackedText(ctx, text, 0, 0, tracking, true);
    const baseline = height - margin;
    const x =
      label.anchor === "lower-left" ? margin : width - margin - textWidth;

    if (label.plate) {
      // A bracketed chrome plate: a hairline box with the corners cut away,
      // so it reads as HUD furniture rather than a caption box.
      const padX = 26;
      const padY = 20;
      const boxX = x - padX;
      const boxY = baseline - label.size + 4 - padY;
      const boxW = textWidth + padX * 2;
      const boxH = label.size + padY * 2;
      const cut = 18;

      ctx.strokeStyle = withAlpha(palette.panelBorder, 0.95);
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.moveTo(boxX + cut, boxY);
      ctx.lineTo(boxX + boxW, boxY);
      ctx.lineTo(boxX + boxW, boxY + boxH - cut);
      ctx.lineTo(boxX + boxW - cut, boxY + boxH);
      ctx.lineTo(boxX, boxY + boxH);
      ctx.lineTo(boxX, boxY + cut);
      ctx.closePath();
      ctx.stroke();

      ctx.fillStyle = withAlpha(palette.bgDeep, 0.55);
      ctx.fill();

      ctx.strokeStyle = withAlpha(palette.hubArc, 0.8);
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(boxX + 6, boxY + boxH + 10);
      ctx.lineTo(boxX + 78, boxY + boxH + 10);
      ctx.stroke();
    }

    ctx.fillStyle = withAlpha(palette.textBright, 0.96);
    ctx.font = `500 ${label.size}px "${FONT_CONDENSED}"`;
    trackedText(ctx, text, x, baseline, tracking);

    if (label.underline) {
      ctx.strokeStyle = withAlpha(palette.textPale, 0.85);
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.moveTo(x, baseline + label.size * 0.36);
      ctx.lineTo(x + textWidth, baseline + label.size * 0.36);
      ctx.stroke();
    }
  };

  return <Layer draw={draw} width={width} height={height} />;
};
