import React from "react";
import { Composition } from "remotion";
import { DnaHelix, type DnaHelixProps } from "./DnaHelix";

// Reference clip: 13.333 s @ 30 fps = 400 frames.
const FPS = 30;
const DURATION = 400;

export const RemotionRoot: React.FC = () => {
  return (
    <>
      {/* 4K masters. Render with --scale=0.5 for the 1080p deliverables. */}
      <Composition
        id="DnaHelixGrowth-V1"
        component={DnaHelix}
        durationInFrames={DURATION}
        fps={FPS}
        width={3840}
        height={2160}
        defaultProps={{ palette: "cyanRed" } satisfies DnaHelixProps}
      />
      <Composition
        id="DnaHelixGrowth-V2"
        component={DnaHelix}
        durationInFrames={DURATION}
        fps={FPS}
        width={3840}
        height={2160}
        defaultProps={{ palette: "goldViolet" } satisfies DnaHelixProps}
      />
      {/* Lightweight previews of the same scenes for Remotion Studio. */}
      <Composition
        id="Preview-V1"
        component={DnaHelix}
        durationInFrames={DURATION}
        fps={FPS}
        width={1280}
        height={720}
        defaultProps={{ palette: "cyanRed" } satisfies DnaHelixProps}
      />
      <Composition
        id="Preview-V2"
        component={DnaHelix}
        durationInFrames={DURATION}
        fps={FPS}
        width={1280}
        height={720}
        defaultProps={{ palette: "goldViolet" } satisfies DnaHelixProps}
      />
    </>
  );
};
