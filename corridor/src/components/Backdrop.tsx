/**
 * The corridor's ground: a deep flat fill plus a wash that lifts toward the
 * horizon, so the frame reads as receding into light rather than into a wall
 * of black.
 */
import React from "react";
import { useCanvasLayer } from "../lib/canvasLayers";
import { rgba } from "../lib/color";
import { CorridorGeometry } from "../lib/perspective";

export interface BackdropProps {
  order: number;
  geo: CorridorGeometry;
  palette: Record<string, string>;
}

export const Backdrop: React.FC<BackdropProps> = ({ order, geo, palette }) => {
  useCanvasLayer({
    id: "backdrop",
    order,
    draw: (ctx) => {
      const { width, height, horizonY } = geo;
      ctx.fillStyle = palette.backgroundDeep;
      ctx.fillRect(0, 0, width, height);

      const wash = ctx.createLinearGradient(0, 0, 0, height);
      const h = Math.max(0.001, Math.min(0.999, horizonY / height));
      wash.addColorStop(0, rgba(palette.backgroundDeep, 0));
      wash.addColorStop(Math.max(0, h - 0.3), rgba(palette.backgroundWash, 0.1));
      wash.addColorStop(h, rgba(palette.backgroundWash, 0.5));
      wash.addColorStop(Math.min(1, h + 0.26), rgba(palette.backgroundWash, 0.14));
      wash.addColorStop(1, rgba(palette.backgroundDeep, 0));
      ctx.fillStyle = wash;
      ctx.fillRect(0, 0, width, height);

      // A lateral falloff so the wash concentrates on the vanishing point.
      const side = ctx.createLinearGradient(0, 0, width, 0);
      side.addColorStop(0, rgba(palette.shadow, 0.42));
      side.addColorStop(0.5, rgba(palette.shadow, 0));
      side.addColorStop(1, rgba(palette.shadow, 0.42));
      ctx.fillStyle = side;
      ctx.fillRect(0, 0, width, height);
    },
  });
  return null;
};
