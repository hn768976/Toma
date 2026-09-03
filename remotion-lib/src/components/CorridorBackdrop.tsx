/**
 * The corridor's ground: a deep flat fill plus a wash that lifts toward the
 * horizon, so the frame reads as receding into light rather than into a wall
 * of black.
 */
import React from "react";
import { useCanvasLayer } from "../lib/canvasLayers";
import { rgba } from "../lib/color";
import { CorridorGeometry } from "../lib/perspective";

export interface CorridorBackdropProps {
  order: number;
  geo: CorridorGeometry;
  /** Base fill for the whole frame. */
  deep: string;
  /** Colour of the wash that lifts toward the horizon. */
  wash: string;
  /** Colour the left and right edges fall off toward. */
  shadow: string;
}

export const CorridorBackdrop: React.FC<CorridorBackdropProps> = ({
  order,
  geo,
  deep,
  wash: washColor,
  shadow,
}) => {
  useCanvasLayer({
    id: "backdrop",
    order,
    draw: (ctx) => {
      const { width, height, horizonY } = geo;
      ctx.fillStyle = deep;
      ctx.fillRect(0, 0, width, height);

      const wash = ctx.createLinearGradient(0, 0, 0, height);
      const h = Math.max(0.001, Math.min(0.999, horizonY / height));
      wash.addColorStop(0, rgba(deep, 0));
      wash.addColorStop(Math.max(0, h - 0.3), rgba(washColor, 0.1));
      wash.addColorStop(h, rgba(washColor, 0.5));
      wash.addColorStop(Math.min(1, h + 0.26), rgba(washColor, 0.14));
      wash.addColorStop(1, rgba(deep, 0));
      ctx.fillStyle = wash;
      ctx.fillRect(0, 0, width, height);

      // A lateral falloff so the wash concentrates on the vanishing point.
      const side = ctx.createLinearGradient(0, 0, width, 0);
      side.addColorStop(0, rgba(shadow, 0.42));
      side.addColorStop(0.5, rgba(shadow, 0));
      side.addColorStop(1, rgba(shadow, 0.42));
      ctx.fillStyle = side;
      ctx.fillRect(0, 0, width, height);
    },
  });
  return null;
};
