import React from "react";
import { CanvasLayer } from "./CanvasLayer";
import { measureText } from "../fonts";
import { withAlpha } from "../color";
import type { Layout } from "../layout";
import type { FontRole, Palette } from "../variants";
import { TEXT_TRACKING, typedFont, withEntrance } from "./TypedText";
import { NO_ENTRANCE } from "../stages";
import type { Entrance } from "../stages";

/**
 * A thin vertical bar sitting after the last typed character. Its opacity is
 * decided by the typing engine: solid while characters are moving, blinking on
 * a 30-frame cycle once the field goes still.
 */
export const Cursor: React.FC<{
  layout: Layout;
  palette: Palette;
  text: string;
  role: FontRole;
  weight: number;
  opacity: number;
  bloom: boolean;
  entrance?: Entrance;
}> = ({ layout, palette, text, role, weight, opacity, bloom, entrance = NO_ENTRANCE }) => {
  return (
    <CanvasLayer
      x={layout.layerX}
      y={layout.layerY}
      width={layout.layerW}
      height={layout.layerH}
      draw={(ctx) => {
        if (opacity <= 0) {
          return;
        }
        const transformed = withEntrance(ctx, layout, entrance);
        const font = typedFont(layout, role, weight);
        const tracking = layout.textSize * TEXT_TRACKING;
        const advance = measureText(text, font, tracking);
        const x = Math.min(
          layout.textX + advance + layout.textSize * 0.1,
          layout.textRight,
        );
        const w = Math.max(2, layout.textSize * 0.07);
        const h = layout.textSize * 1.16;
        const y = layout.iconCy - h / 2;

        if (bloom) {
          ctx.save();
          ctx.globalCompositeOperation = "lighter";
          ctx.shadowColor = palette.cursor;
          ctx.shadowBlur = layout.textSize * 0.6;
          ctx.fillStyle = withAlpha(palette.cursor, 0.55 * opacity);
          ctx.fillRect(x, y, w, h);
          ctx.shadowBlur = layout.textSize * 0.22;
          ctx.fillRect(x, y, w, h);
          ctx.restore();
        }

        ctx.save();
        ctx.fillStyle = withAlpha(palette.cursor, opacity);
        ctx.fillRect(x, y, w, h);
        ctx.restore();

        if (transformed) {
          ctx.restore();
        }
      }}
    />
  );
};
