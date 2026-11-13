import { Composition } from "remotion";
import { ParticleTunnel } from "./tunnel/ParticleTunnel";

/**
 * Particle Tunnel Collision — two 4K (3840x2160) compositions at 30 fps.
 * Duration: 300 frames = 10.000 s, identical to the reference clip.
 */
export const WIDTH = 3840;
export const HEIGHT = 2160;
export const FPS = 30;
export const DURATION_IN_FRAMES = 300;

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="ParticleTunnelCollision-V1-Match"
        component={ParticleTunnel}
        durationInFrames={DURATION_IN_FRAMES}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
        defaultProps={{ variant: "match" as const }}
      />
      <Composition
        id="ParticleTunnelCollision-V2-EmberPalette"
        component={ParticleTunnel}
        durationInFrames={DURATION_IN_FRAMES}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
        defaultProps={{ variant: "ember" as const }}
      />
    </>
  );
};
