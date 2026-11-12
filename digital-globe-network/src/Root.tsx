import { Composition } from "remotion";
import { DigitalGlobe, type DigitalGlobeProps } from "./globe/DigitalGlobe";

// Authored at native 4K UHD (3840x2160), 30 fps.
// Duration matches the reference exactly: 29.667 s = 890 frames.
export const WIDTH = 3840;
export const HEIGHT = 2160;
export const FPS = 30;
export const DURATION_IN_FRAMES = 890;

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="DigitalGlobe-V1-Reference"
        component={DigitalGlobe}
        durationInFrames={DURATION_IN_FRAMES}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
        defaultProps={{ variant: "reference" } satisfies DigitalGlobeProps}
      />
      <Composition
        id="DigitalGlobe-V2-OrbitCamera"
        component={DigitalGlobe}
        durationInFrames={DURATION_IN_FRAMES}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
        defaultProps={{ variant: "orbit" } satisfies DigitalGlobeProps}
      />
    </>
  );
};
