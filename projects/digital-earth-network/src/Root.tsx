import "./index.css";
import { Composition } from "remotion";
import { EarthNetwork } from "./earth/EarthNetwork";

// Reference clip: 892 frames @ 30 fps = 29.733 s
export const DURATION_IN_FRAMES = 892;
export const FPS = 30;
// Compositions are authored in 4K UHD. Deliverables are rendered with --scale=0.5 (1920x1080).
export const WIDTH = 3840;
export const HEIGHT = 2160;

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="EarthNetwork-V1-Match"
        component={EarthNetwork}
        durationInFrames={DURATION_IN_FRAMES}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
        defaultProps={{ variant: "v1" as const }}
      />
      <Composition
        id="EarthNetwork-V2-OrbitalCamera"
        component={EarthNetwork}
        durationInFrames={DURATION_IN_FRAMES}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
        defaultProps={{ variant: "v2" as const }}
      />
    </>
  );
};
