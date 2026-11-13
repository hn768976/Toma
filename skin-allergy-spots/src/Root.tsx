import React from "react";
import { Composition } from "remotion";
import { SkinSpots, type SkinSpotsProps } from "./SkinSpots";

// Reference clip: 6.000 s @ 30 fps = 180 frames.
const FPS = 30;
const DURATION = 180;

export const RemotionRoot: React.FC = () => {
  return (
    <>
      {/* 4K masters. Render with --scale=0.5 for the 1080p deliverables. */}
      <Composition
        id="SkinAllergySpots-V1"
        component={SkinSpots}
        durationInFrames={DURATION}
        fps={FPS}
        width={3840}
        height={2160}
        defaultProps={{ camera: "reference" } satisfies SkinSpotsProps}
      />
      <Composition
        id="SkinAllergySpots-V2"
        component={SkinSpots}
        durationInFrames={DURATION}
        fps={FPS}
        width={3840}
        height={2160}
        defaultProps={{ camera: "orbit" } satisfies SkinSpotsProps}
      />
      {/* Lightweight previews of the same scenes for Remotion Studio. */}
      <Composition
        id="Preview-V1"
        component={SkinSpots}
        durationInFrames={DURATION}
        fps={FPS}
        width={1280}
        height={720}
        defaultProps={{ camera: "reference" } satisfies SkinSpotsProps}
      />
      <Composition
        id="Preview-V2"
        component={SkinSpots}
        durationInFrames={DURATION}
        fps={FPS}
        width={1280}
        height={720}
        defaultProps={{ camera: "orbit" } satisfies SkinSpotsProps}
      />
    </>
  );
};
