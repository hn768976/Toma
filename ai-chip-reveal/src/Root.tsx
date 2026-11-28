import React from "react";
import { Composition } from "remotion";
import {
  DURATION_IN_FRAMES,
  FPS,
  HEIGHT,
  PALETTE_V1,
  PALETTE_V2,
  SHORT_NAME,
  WIDTH,
} from "./config";
import { Film } from "./Film";

/** Frames used for look development: start, middle and the peak moment. */
export const LOOKDEV_FRAMES = [15, 45, 180] as const;

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id={`V1-${SHORT_NAME}`}
        component={Film}
        width={WIDTH}
        height={HEIGHT}
        fps={FPS}
        durationInFrames={DURATION_IN_FRAMES}
        defaultProps={{ palette: PALETTE_V1 }}
      />
      <Composition
        id={`V2-${SHORT_NAME}`}
        component={Film}
        width={WIDTH}
        height={HEIGHT}
        fps={FPS}
        durationInFrames={DURATION_IN_FRAMES}
        defaultProps={{ palette: PALETTE_V2 }}
      />
      {/* Look-dev: frame i of this composition shows LOOKDEV_FRAMES[i] */}
      <Composition
        id="LookDev"
        component={Film}
        width={WIDTH}
        height={HEIGHT}
        fps={FPS}
        durationInFrames={LOOKDEV_FRAMES.length}
        defaultProps={{ palette: PALETTE_V1, stills: LOOKDEV_FRAMES }}
      />
    </>
  );
};
