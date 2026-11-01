import { Composition } from "remotion";
import { TubeBloom } from "./bloom/TubeBloom";
import { PORCELAIN_RASPBERRY } from "./bloom/looks";

// Master compositions are authored in 4K UHD. Deliverables are rendered at
// 1080p with `--scale=0.5` (see README).
export const WIDTH = 3840;
export const HEIGHT = 2160;
export const FPS = 30;
// The reference is 270 frames long (9.009 s @ 29.97 fps). At exactly 30 fps
// the same 270 frames last 9.000 s — the closest frame-accurate match.
export const DURATION_IN_FRAMES = 270;

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="TubeBloom-V1-Match"
        component={TubeBloom}
        durationInFrames={DURATION_IN_FRAMES}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
        defaultProps={{ look: PORCELAIN_RASPBERRY, camera: "topDown" as const }}
      />
      <Composition
        id="TubeBloom-V2-LowOrbit"
        component={TubeBloom}
        durationInFrames={DURATION_IN_FRAMES}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
        defaultProps={{ look: PORCELAIN_RASPBERRY, camera: "lowOrbit" as const }}
      />
    </>
  );
};
