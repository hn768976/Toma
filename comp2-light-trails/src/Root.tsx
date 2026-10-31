import { Composition } from "remotion";
import { LightTrails } from "./trails/LightTrails";

// 4K UHD masters. Reference clip: 250 frames @ 30 fps = 8.333 s.
const WIDTH = 3840;
const HEIGHT = 2160;
const FPS = 30;
const DURATION_IN_FRAMES = 250;

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="LightTrails-V1-Gold"
        component={LightTrails}
        durationInFrames={DURATION_IN_FRAMES}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
        defaultProps={{ palette: "gold" as const }}
      />
      <Composition
        id="LightTrails-V2-Violet"
        component={LightTrails}
        durationInFrames={DURATION_IN_FRAMES}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
        defaultProps={{ palette: "violet" as const }}
      />
    </>
  );
};
