import { Composition } from "remotion";
import { StageLights } from "./StageLights";

// Reference clip: 601 frames @ 29.97 fps = 20.053 s. At exactly 30 fps the
// nearest frame count is 602 frames = 20.067 s (13 ms off, < half a frame).
const FPS = 30;
const DURATION = 602;

export const RemotionRoot: React.FC = () => {
  return (
    <>
      {/* Version 1: locked-off front view of the 8 x 4 light wall. */}
      <Composition
        id="StageLights-V1"
        component={StageLights}
        fps={FPS}
        durationInFrames={DURATION}
        width={3840}
        height={2160}
        defaultProps={{ camera: "front" as const }}
      />
      {/* Version 2: same lights and timing, oblique orbiting dolly camera. */}
      <Composition
        id="StageLights-V2"
        component={StageLights}
        fps={FPS}
        durationInFrames={DURATION}
        width={3840}
        height={2160}
        defaultProps={{ camera: "orbit" as const }}
      />
    </>
  );
};
