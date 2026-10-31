import { Composition } from "remotion";
import { NeonArcStreaks, streaksSchema } from "./streaks/NeonArcStreaks";

// Reference clip: 360 frames (12.012 s @ 29.97 fps). At exactly 30 fps the
// frame count is kept identical (360 frames = 12.000 s = six 2 s loops).
const FPS = 30;
const DURATION_IN_FRAMES = 360;

export const RemotionRoot: React.FC = () => {
  return (
    <>
      {/* Version 1 — matches the reference framing, palette and motion. */}
      <Composition
        id="NeonArcStreaks-V1-4K"
        component={NeonArcStreaks}
        schema={streaksSchema}
        durationInFrames={DURATION_IN_FRAMES}
        fps={FPS}
        width={3840}
        height={2160}
        defaultProps={{ camera: "reference" as const }}
      />
      {/* Version 2 — same streak field, low tilted camera with a rolling dolly-in. */}
      <Composition
        id="NeonArcStreaks-V2-4K"
        component={NeonArcStreaks}
        schema={streaksSchema}
        durationInFrames={DURATION_IN_FRAMES}
        fps={FPS}
        width={3840}
        height={2160}
        defaultProps={{ camera: "lowAngle" as const }}
      />
    </>
  );
};
