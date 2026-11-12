import { Composition } from "remotion";
import { DnaHelixScene } from "./dna/DnaHelixScene";

// Reference: 801 frames @ 30 fps = 26.700 s
export const FPS = 30;
export const DURATION_IN_FRAMES = 801;
export const WIDTH = 3840;
export const HEIGHT = 2160;

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="V1-EmeraldPlexusHelix-4K"
        component={DnaHelixScene}
        durationInFrames={DURATION_IN_FRAMES}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
        defaultProps={{ preset: "emerald-v1" }}
      />
      <Composition
        id="V2-EmeraldPlexusHelixOrbit-4K"
        component={DnaHelixScene}
        durationInFrames={DURATION_IN_FRAMES}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
        defaultProps={{ preset: "emerald-v2" }}
      />
    </>
  );
};
