import { Composition } from "remotion";
import { ClockSpiral, clockSpiralSchema } from "./clock-spiral/ClockSpiral";
import { DURATION_IN_FRAMES, FPS, HEIGHT, WIDTH } from "./constants";

export const RemotionRoot: React.FC = () => {
  return (
    <>
      {/* Version 1: matches the reference (sepia parchment clock spiral). */}
      <Composition
        id="ClockSpiral-V1-4K"
        component={ClockSpiral}
        durationInFrames={DURATION_IN_FRAMES}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
        schema={clockSpiralSchema}
        defaultProps={{ palette: "sepia" as const }}
      />
      {/* Version 2: same spiral and motion, moonlit silver / ice-blue palette. */}
      <Composition
        id="ClockSpiral-V2-4K"
        component={ClockSpiral}
        durationInFrames={DURATION_IN_FRAMES}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
        schema={clockSpiralSchema}
        defaultProps={{ palette: "frost" as const }}
      />
    </>
  );
};
