import { Composition } from "remotion";
import { GlowSpheres, glowSpheresSchema } from "./GlowSpheres";

// 4K UHD compositions. Reference clip: 8.342 s -> 250 frames @ 30 fps.
export const WIDTH = 3840;
export const HEIGHT = 2160;
export const FPS = 30;
export const DURATION_IN_FRAMES = 250;

export const RemotionRoot: React.FC = () => {
  return (
    <>
      {/* Version 1 – matches the reference: ultraviolet palette */}
      <Composition
        id="GlowSpheres-V1"
        component={GlowSpheres}
        durationInFrames={DURATION_IN_FRAMES}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
        schema={glowSpheresSchema}
        defaultProps={{ palette: "ultraviolet" as const, seed: 11, pixelRatio: 1 }}
      />
      {/* Version 2 – same animation, electric cyan / teal palette */}
      <Composition
        id="GlowSpheres-V2"
        component={GlowSpheres}
        durationInFrames={DURATION_IN_FRAMES}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
        schema={glowSpheresSchema}
        defaultProps={{ palette: "electric-cyan" as const, seed: 11, pixelRatio: 1 }}
      />
    </>
  );
};
