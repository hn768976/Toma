import { Composition } from "remotion";
import { LightTunnel } from "./tunnel/LightTunnel";

// Reference clip: 28.8 s -> exactly 864 frames at 30 fps.
export const DURATION_FRAMES = 864;

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="LightTunnel-V1-Match"
        component={LightTunnel}
        durationInFrames={DURATION_FRAMES}
        fps={30}
        width={3840}
        height={2160}
        defaultProps={{ variant: "v1" as const }}
      />
      <Composition
        id="LightTunnel-V2-SolarGold"
        component={LightTunnel}
        durationInFrames={DURATION_FRAMES}
        fps={30}
        width={3840}
        height={2160}
        defaultProps={{ variant: "v2" as const }}
      />
    </>
  );
};
