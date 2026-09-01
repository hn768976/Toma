import React, { useMemo } from "react";
import { useCurrentFrame } from "remotion";
import { useCanvas, useFrameGuard } from "../useCanvas";
import { buildLandPath } from "../geo";
import {
  HEIGHT,
  TILE_COPIES,
  WIDTH,
  setPlaneTransform,
  tileBaseX,
} from "../plane";
import type { Plane } from "../plane";
import type { VariantConfig } from "../variants";

type Props = { plane: Plane; config: VariantConfig; variantKey: string };

/** Vertical exaggeration of the projection, and where its equator sits. */
const MAP_STRETCH_Y = 1.4;
const MAP_CENTER_Y = -0.04;

/**
 * The ground of the frame: the background wash, and Natural Earth land at very
 * low contrast beneath everything else. It is a shape you notice second, never
 * the subject.
 */
export const WorldBackdrop: React.FC<Props> = ({ plane, config, variantKey }) => {
  const frame = useCurrentFrame();
  const { ctx, mount } = useCanvas(WIDTH, HEIGHT);
  const shouldDraw = useFrameGuard();

  // Projected once. Re-projecting 110m land every frame would dominate the
  // frame budget for something that never changes shape.
  const land = useMemo(() => buildLandPath(plane.tileW), [plane.tileW]);

  if (shouldDraw(`${variantKey}:${frame}`)) {
    const { palette } = config;

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = palette.bgDeep;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    // A soft lift towards the centre so the field is not a flat block.
    const wash = ctx.createRadialGradient(
      WIDTH * 0.46,
      HEIGHT * 0.44,
      0,
      WIDTH * 0.46,
      HEIGHT * 0.44,
      WIDTH * 0.62,
    );
    wash.addColorStop(0, palette.bgWash);
    wash.addColorStop(1, palette.bgDeep);
    ctx.globalAlpha = 0.75;
    ctx.fillStyle = wash;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
    ctx.globalAlpha = 1;

    setPlaneTransform(ctx, plane, frame);
    const baseX = tileBaseX(frame, plane);
    ctx.fillStyle = palette.mapLand;
    ctx.globalAlpha = 0.9;
    for (const k of TILE_COPIES) {
      ctx.save();
      // Equirectangular land is square-ish; stretch it vertically so the
      // continents reach past the top and bottom of the frame rather than
      // sitting as a band across the middle.
      ctx.translate(baseX + k * plane.tileW, MAP_CENTER_Y * plane.tileH);
      ctx.scale(1, MAP_STRETCH_Y);
      ctx.fill(land);
      ctx.restore();
    }
    ctx.globalAlpha = 1;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }

  return <div ref={mount} style={{ position: "absolute", inset: 0 }} />;
};
