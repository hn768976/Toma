import { Composition } from "remotion";
import { Analytics } from "./AnalyticsFlat";
import { AnalyticsTilted } from "./three/AnalyticsTilted";
import { DURATION_IN_FRAMES, FPS } from "./dashboard/timeline";

/**
 * 300 frames at 30fps = 10.0s, one shot. Frame 0 and frame 300 differ by
 * design — this is deliberately NOT a loop.
 */
export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="AnalyticsFlat"
        component={Analytics}
        durationInFrames={DURATION_IN_FRAMES}
        fps={FPS}
        width={3840}
        height={2160}
        defaultProps={{ variant: "flat" as const }}
      />
      <Composition
        id="AnalyticsTilted"
        component={AnalyticsTilted}
        durationInFrames={DURATION_IN_FRAMES}
        fps={FPS}
        width={3840}
        height={2160}
        defaultProps={{ variant: "tilted" as const }}
      />
    </>
  );
};
