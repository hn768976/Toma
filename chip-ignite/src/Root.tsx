import React from "react";
import { Composition } from "remotion";
import {
  CAMERA_V1,
  CAMERA_V2,
  DURATION_IN_FRAMES,
  FPS,
  HEIGHT,
  SHORT_NAME,
  WIDTH,
} from "./config";
import { Film } from "./Film";

/** Frames used for look development: start, middle and the peak moment. */
export const LOOKDEV_FRAMES = [15, 192, 252] as const;

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
        defaultProps={{ camera: CAMERA_V1 }}
      />
      <Composition
        id={`V2-${SHORT_NAME}`}
        component={Film}
        width={WIDTH}
        height={HEIGHT}
        fps={FPS}
        durationInFrames={DURATION_IN_FRAMES}
        defaultProps={{ camera: CAMERA_V2 }}
      />
      {/* Look-dev: frame i of this composition shows LOOKDEV_FRAMES[i] */}
      <Composition
        id="LookDev"
        component={Film}
        width={WIDTH}
        height={HEIGHT}
        fps={FPS}
        durationInFrames={LOOKDEV_FRAMES.length}
        defaultProps={{ camera: CAMERA_V1, stills: LOOKDEV_FRAMES }}
      />
    </>
  );
};
