import { Composition } from "remotion";
import { NeonWaveFlow } from "./neon/NeonWaveFlow";

// Reference clip: 20.02 s. At exactly 30 fps the closest frame count is 601
// (20.033 s, within one frame of the reference).
const DURATION_IN_FRAMES = 601;

// 4K UHD masters; deliverables are rendered from these with --scale=0.5.
const WIDTH = 3840;
const HEIGHT = 2160;

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="NeonWaveFlow-V1-LowTracking"
        component={NeonWaveFlow}
        durationInFrames={DURATION_IN_FRAMES}
        fps={30}
        width={WIDTH}
        height={HEIGHT}
        defaultProps={{ rig: "lowTracking" as const }}
      />
      <Composition
        id="NeonWaveFlow-V2-CraneSweep"
        component={NeonWaveFlow}
        durationInFrames={DURATION_IN_FRAMES}
        fps={30}
        width={WIDTH}
        height={HEIGHT}
        defaultProps={{ rig: "craneSweep" as const }}
      />
    </>
  );
};
