import React, { useLayoutEffect } from "react";
import { GRID_SPACING, HEIGHT, WIDTH } from "./constants";
import { withAlpha } from "../lib/color";
import type { HudPlane } from "./hud-plane";
import { clearPlaneSurfaces } from "../lib/TiltedPlane";
import { GLOW_SCALE, type Surfaces } from "./surfaces";

/**
 * First layer of the frame, and therefore also the one that resets state: it
 * clears the main canvas and all four offscreen surfaces before any other
 * layer draws into them. Being a child of <TiltedPlane> means its effect runs
 * before the plane composites, which is exactly the order we need.
 *
 * The grid spans the whole plane and is painted through every depth band, so
 * it softens toward the top and bottom of frame along with everything else.
 */
export const BackgroundGrid: React.FC<{
  plane: HudPlane;
  surfaces: Surfaces;
  target: React.RefObject<HTMLCanvasElement | null>;
}> = ({ plane, surfaces, target }) => {
  useLayoutEffect(() => {
    const p = plane.variant.palette;

    clearPlaneSurfaces(surfaces.dof, {
      glow: { canvas: surfaces.glow, scale: GLOW_SCALE },
    });

    const main = target.current?.getContext("2d");
    if (main) {
      main.save();
      main.setTransform(1, 0, 0, 1, 0, 0);
      main.globalCompositeOperation = "source-over";
      main.fillStyle = p.bgDeep;
      main.fillRect(0, 0, WIDTH, HEIGHT);
      // A single broad wash so the deep background is not a dead flat field.
      const g = main.createRadialGradient(
        WIDTH * 0.56,
        HEIGHT * 0.44,
        0,
        WIDTH * 0.56,
        HEIGHT * 0.44,
        WIDTH * 0.72,
      );
      g.addColorStop(0, withAlpha(p.bgWash, 0.5));
      g.addColorStop(0.55, withAlpha(p.bgWash, 0.18));
      g.addColorStop(1, withAlpha(p.bgWash, 0));
      main.fillStyle = g;
      main.fillRect(0, 0, WIDTH, HEIGHT);
      main.restore();
    }

    const { minX, maxX, minY, maxY } = plane.bounds;
    const pad = 500;
    const off = ((plane.drift % GRID_SPACING) + GRID_SPACING) % GRID_SPACING;
    plane.paint(
      {
        u: minX - pad,
        v: minY - pad,
        w: maxX - minX + pad * 2,
        h: maxY - minY + pad * 2,
      },
      (ctx) => {
        ctx.lineWidth = 1.6;
        const x0 = Math.floor((minX - pad) / GRID_SPACING) * GRID_SPACING + off;
        for (let x = x0; x < maxX + pad; x += GRID_SPACING) {
          const major = Math.round((x - off) / GRID_SPACING) % 5 === 0;
          ctx.strokeStyle = withAlpha(p.gridLine, major ? 0.55 : 0.28);
          ctx.beginPath();
          ctx.moveTo(x, minY - pad);
          ctx.lineTo(x, maxY + pad);
          ctx.stroke();
        }
        const y0 = Math.floor((minY - pad) / GRID_SPACING) * GRID_SPACING;
        for (let y = y0; y < maxY + pad; y += GRID_SPACING) {
          const major = Math.round(y / GRID_SPACING) % 5 === 0;
          ctx.strokeStyle = withAlpha(p.gridLine, major ? 0.5 : 0.24);
          ctx.beginPath();
          ctx.moveTo(minX - pad, y);
          ctx.lineTo(maxX + pad, y);
          ctx.stroke();
        }
      },
    );
  });

  return null;
};
