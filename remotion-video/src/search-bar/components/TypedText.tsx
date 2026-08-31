import React from "react";
import { CanvasLayer, roundedRectPath } from "./CanvasLayer";
import { fillTracked, fontFamilyFor, fontString } from "../fonts";
import { withAlpha } from "../color";
import type { Layout } from "../layout";
import type { FontRole, Palette } from "../variants";

/** Tracking on the typed term, as a fraction of its size. */
export const TEXT_TRACKING = 0.035;
export const TEXT_WEIGHT = 700;

export const typedFont = (layout: Layout, role: FontRole): string =>
  fontString(TEXT_WEIGHT, layout.textSize, fontFamilyFor(role));

/**
 * The characters that have been typed so far. Which characters those are is
 * decided entirely by the schedule in typing.ts — this only draws them.
 */
export const TypedText: React.FC<{
  layout: Layout;
  palette: Palette;
  text: string;
  role: FontRole;
  bloom: boolean;
}> = ({ layout, palette, text, role, bloom }) => {
  return (
    <CanvasLayer
      x={layout.layerX}
      y={layout.layerY}
      width={layout.layerW}
      height={layout.layerH}
      draw={(ctx) => {
        if (text.length === 0) {
          return;
        }
        const tracking = layout.textSize * TEXT_TRACKING;
        const baseline = layout.iconCy + layout.textSize * 0.02;

        // Nothing may escape the pill, however long the term gets.
        roundedRectPath(
          ctx,
          layout.barX,
          layout.barY,
          layout.barW,
          layout.barH,
          layout.radius,
        );
        ctx.clip();

        ctx.font = typedFont(layout, role);
        ctx.textBaseline = "middle";
        ctx.textAlign = "left";

        if (bloom) {
          ctx.save();
          ctx.globalCompositeOperation = "lighter";
          ctx.fillStyle = withAlpha(palette.text, 0.32);
          ctx.shadowColor = withAlpha(palette.cursor, 0.85);
          ctx.shadowBlur = layout.textSize * 0.55;
          fillTracked(ctx, text, layout.textX, baseline, tracking);
          ctx.shadowBlur = layout.textSize * 0.2;
          fillTracked(ctx, text, layout.textX, baseline, tracking);
          ctx.restore();
        }

        ctx.fillStyle = palette.text;
        fillTracked(ctx, text, layout.textX, baseline, tracking);
      }}
    />
  );
};
