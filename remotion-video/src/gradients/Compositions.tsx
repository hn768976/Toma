import React from "react";
import { Composition } from "remotion";
import { GradientComposition } from "./GradientComposition";
import {
  FPS,
  HD_HEIGHT,
  HD_WIDTH,
  UHD_HEIGHT,
  UHD_WIDTH,
  VARIANTS,
  gradientSchema,
} from "./variants";

/**
 * Each variant is registered twice. The shader is written in normalised
 * coordinates, so the 4K and 1080p entries are the same picture sampled at
 * different densities -- not a scaled-up copy. Grain is the one thing that
 * would have drifted, and it is normalised against height inside the shader.
 */
export const GradientCompositions: React.FC = () => {
  return (
    <>
      {VARIANTS.map((variant) => (
        <React.Fragment key={variant.id}>
          <Composition
            id={`${variant.id}-4K`}
            component={GradientComposition}
            durationInFrames={variant.durationInFrames}
            fps={FPS}
            width={UHD_WIDTH}
            height={UHD_HEIGHT}
            schema={gradientSchema}
            defaultProps={variant.props}
          />
          <Composition
            id={`${variant.id}-1080p`}
            component={GradientComposition}
            durationInFrames={variant.durationInFrames}
            fps={FPS}
            width={HD_WIDTH}
            height={HD_HEIGHT}
            schema={gradientSchema}
            defaultProps={variant.props}
          />
        </React.Fragment>
      ))}
    </>
  );
};
