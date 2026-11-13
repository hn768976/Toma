import React from "react";
import { Composition } from "remotion";
import { AiChip } from "./AiChip";

// Reference clip: 8.04 s. At 30 fps that is 241 frames (8.033 s) - the
// closest whole-frame duration.
export const FPS = 30;
export const DURATION_IN_FRAMES = 241;
export const WIDTH = 3840;
export const HEIGHT = 2160;

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="AiChip-V1-Reference"
        component={AiChip}
        durationInFrames={DURATION_IN_FRAMES}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
        defaultProps={{ cameraPath: "reference" as const }}
      />
      <Composition
        id="AiChip-V2-OrbitCamera"
        component={AiChip}
        durationInFrames={DURATION_IN_FRAMES}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
        defaultProps={{ cameraPath: "orbit" as const }}
      />
    </>
  );
};
