/**
 * The subject: a thin rectangular outline with four bright, differently hued
 * corner nodes, and an interior deliberately left empty for a title.
 *
 * The mechanics live in the shared library's <CornerNodeFrame>; this is the
 * variant-aware adapter that turns a VariantConfig into its props, so the
 * library component never needs to know about this project's palette shape.
 */
import React, { useMemo } from "react";
import { CornerNodeFrame as LibCornerNodeFrame } from "../lib/components/CornerNodeFrame";
import {
  DURATION_IN_FRAMES,
  HEIGHT,
  WIDTH,
  layerStyle,
} from "./constants";
import type { VariantConfig } from "./variants";

/**
 * How far the plate interior is calmed. The frame is a title plate: rain and
 * sparks still cross the whole composition, but inside the plate they are
 * pushed down to a clean, legible negative space.
 */
const INTERIOR_SCRIM = 0.78;

export const CornerNodeFrame: React.FC<{ variant: VariantConfig }> = ({
  variant,
}) => {
  const { palette, frame: geometry } = variant;

  const rect = useMemo(() => {
    const w = geometry.widthFraction * WIDTH;
    const h = geometry.heightFraction * HEIGHT;
    return {
      x: geometry.centerXFraction * WIDTH - w / 2,
      y: geometry.centerYFraction * HEIGHT - h / 2,
      w,
      h,
    };
  }, [geometry]);

  const interiorScrim = useMemo(
    () => ({ color: palette.backgroundDeep, opacity: INTERIOR_SCRIM }),
    [palette.backgroundDeep],
  );

  return (
    <LibCornerNodeFrame
      width={WIDTH}
      height={HEIGHT}
      loopLength={DURATION_IN_FRAMES}
      rect={rect}
      lineColor={palette.frameLine}
      coreColor={palette.frameCore}
      nodeColors={palette.nodes}
      strokeWidth={geometry.strokeWidth}
      nodeHaloRadius={geometry.nodeHaloRadius}
      streakScale={geometry.streakScale}
      highlightCircuits={geometry.highlightCircuits}
      interiorScrim={interiorScrim}
      style={layerStyle}
    />
  );
};
