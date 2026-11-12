import { Composition } from "remotion";
import { DnaHelixScene } from "./dna/DnaHelixScene";

// Reference: 401 frames @ 30 fps = 13.367 s
export const FPS = 30;
export const DURATION_IN_FRAMES = 401;
export const WIDTH = 3840;
export const HEIGHT = 2160;

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="V1-RoseParticleHelix-4K"
        component={DnaHelixScene}
        durationInFrames={DURATION_IN_FRAMES}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
        defaultProps={{ preset: "rose-v1" }}
      />
      <Composition
        id="V2-MidnightGoldParticleHelix-4K"
        component={DnaHelixScene}
        durationInFrames={DURATION_IN_FRAMES}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
        defaultProps={{ preset: "rose-v2" }}
      />
    </>
  );
};
