import React from "react";
import { Composition } from "remotion";
import { SkinLayers } from "./SkinLayers";
import { DURATION_FRAMES, FPS, HEIGHT, WIDTH } from "./timeline";

export const RemotionRoot: React.FC = () => {
  return (
    <>
      {/* Version 1 – matches the reference: locked-off three-quarter view. */}
      <Composition
        id="SkinLayersV1"
        component={SkinLayers}
        durationInFrames={DURATION_FRAMES}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
        defaultProps={{ variant: "reference" as const }}
      />
      {/* Version 2 – same model and timing with an orbiting, craning camera. */}
      <Composition
        id="SkinLayersV2"
        component={SkinLayers}
        durationInFrames={DURATION_FRAMES}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
        defaultProps={{ variant: "orbit" as const }}
      />
    </>
  );
};
