import { Composition } from "remotion";
import { ParticleCollision, ParticleCollisionProps } from "./ParticleCollision";

// Both compositions are authored at 4K UHD (3840x2160), 30 fps.
// Duration matches the reference clip exactly: 20.000 s = 600 frames.
export const FPS = 30;
export const DURATION_IN_FRAMES = 600;
export const WIDTH = 3840;
export const HEIGHT = 2160;

export const RemotionRoot: React.FC = () => {
  return (
    <>
      {/* Version 1: matches the reference (golden ribbons, downward tilt). */}
      <Composition
        id="ParticleCollision-V1-4K"
        component={ParticleCollision}
        fps={FPS}
        durationInFrames={DURATION_IN_FRAMES}
        width={WIDTH}
        height={HEIGHT}
        defaultProps={{ variant: "v1" } satisfies ParticleCollisionProps}
      />
      {/* Version 2: same scene, low-angle orbiting crane camera. */}
      <Composition
        id="ParticleCollision-V2-4K"
        component={ParticleCollision}
        fps={FPS}
        durationInFrames={DURATION_IN_FRAMES}
        width={WIDTH}
        height={HEIGHT}
        defaultProps={{ variant: "v2" } satisfies ParticleCollisionProps}
      />
    </>
  );
};
