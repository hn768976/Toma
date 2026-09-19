import React from "react";
import { AbsoluteFill } from "remotion";
import { GradientCanvas } from "./GradientCanvas";
import type { GradientProps } from "./variants";

/**
 * Thin wrapper so the canvas always sits on an opaque backdrop -- if WebGL
 * ever fails to come up we get the palette's darkest stop rather than a
 * transparent hole in the render.
 */
export const GradientComposition: React.FC<GradientProps> = (props) => {
  return (
    <AbsoluteFill style={{ backgroundColor: props.palette[0] }}>
      <GradientCanvas {...props} />
    </AbsoluteFill>
  );
};
