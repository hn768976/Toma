import React from "react";
import { CanvasLayer, roundedRectPath } from "./CanvasLayer";
import { fillTracked, fontFamilyFor, fontString } from "../fonts";
import { withAlpha } from "../color";
import type { Layout } from "../layout";
import { NO_ENTRANCE } from "../stages";
import type { Entrance } from "../stages";
import type { FontRole, Palette } from "../variants";

/** Tracking on the typed term, as a fraction of its size. */
export const TEXT_TRACKING = 0.035;

export const typedFont = (layout: Layout, role: FontRole, weight: number): string =>
  fontString(weight, layout.textSize, fontFamilyFor(role));

/** Applies an entrance transform about the bar's centre, if there is one. */
export const withEntrance = (
  ctx: CanvasRenderingContext2D,
  layout: Layout,
  entrance: Entrance,
): boolean => {
  if (entrance.scale === 1 && entrance.opacity === 1) {
    return false;
  }
  ctx.save();
  ctx.globalAlpha *= entrance.opacity;
  const cx = layout.barX + layout.barW / 2;
  ctx.translate(cx, layout.iconCy);
  ctx.scale(entrance.scale, entrance.scale);
  ctx.translate(-cx, -layout.iconCy);
  return true;
};

/**
 * The characters that have been typed so far. Which characters those are is
 * decided entirely by the schedule in typing.ts — this only draws them.
 */
export const TypedText: React.FC<{
  layout: Layout;
  palette: Palette;
  text: string;
  role: FontRole;
  weight: number;
  bloom: boolean;
  /** Shown in the same slot until the field is focused. */
  placeholder?: string | null;
  placeholderOpacity?: number;
  entrance?: Entrance;
}> = ({
  layout,
  palette,
  text,
  role,
  weight,
  bloom,
  placeholder = null,
  placeholderOpacity = 0,
  entrance = NO_ENTRANCE,
}) => {
  return (
    <CanvasLayer
      x={layout.layerX}
      y={layout.layerY}
      width={layout.layerW}
      height={layout.layerH}
      draw={(ctx) => {
        const showPlaceholder =
          placeholder !== null && placeholderOpacity > 0 && palette.ui !== null;
        if (text.length === 0 && !showPlaceholder) {
          return;
        }
        const transformed = withEntrance(ctx, layout, entrance);
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

        ctx.font = typedFont(layout, role, weight);
        ctx.textBaseline = "middle";
        ctx.textAlign = "left";

        if (showPlaceholder && palette.ui !== null) {
          ctx.fillStyle = withAlpha(palette.ui.placeholder, placeholderOpacity);
          ctx.fillText(placeholder as string, layout.textX, baseline);
        }
        if (text.length === 0) {
          if (transformed) {
            ctx.restore();
          }
          return;
        }

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

        if (transformed) {
          ctx.restore();
        }
      }}
    />
  );
};
