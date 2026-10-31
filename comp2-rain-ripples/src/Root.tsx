import { Composition } from "remotion";
import { RainRipples, rainSchema } from "./rain/RainRipples";

// Both compositions are authored at native 4K UHD (3840×2160), 30 fps.
// Reference = 900 frames @ 29.97 fps = 30.030 s. At exactly 30 fps that is
// 900.9 frames, so 901 frames (30.033 s) is the closest frame-exact length.
const W = 3840;
const H = 2160;
const FPS = 30;
const FRAMES = 901;

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="RainRipples-V1-Reference"
        component={RainRipples}
        schema={rainSchema}
        durationInFrames={FRAMES}
        fps={FPS}
        width={W}
        height={H}
        defaultProps={{ camera: "reference" as const, seed: 7 }}
      />
      <Composition
        id="RainRipples-V2-LowAngleDolly"
        component={RainRipples}
        schema={rainSchema}
        durationInFrames={FRAMES}
        fps={FPS}
        width={W}
        height={H}
        defaultProps={{ camera: "lowAngleDolly" as const, seed: 7 }}
      />
    </>
  );
};
