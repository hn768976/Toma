import { Composition } from "remotion";
import { PlasmaOrb } from "./orb/PlasmaOrb";

// 4K UHD masters. Reference clip: 240 frames @ 30 fps = 8.000 s.
const WIDTH = 3840;
const HEIGHT = 2160;
const FPS = 30;
const DURATION_IN_FRAMES = 240;

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="PlasmaOrb-V1-Match"
        component={PlasmaOrb}
        durationInFrames={DURATION_IN_FRAMES}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
        defaultProps={{ variant: "match" as const }}
      />
      <Composition
        id="PlasmaOrb-V2-Orbit"
        component={PlasmaOrb}
        durationInFrames={DURATION_IN_FRAMES}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
        defaultProps={{ variant: "orbit" as const }}
      />
    </>
  );
};
