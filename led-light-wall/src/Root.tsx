import { Composition } from "remotion";
import { DURATION_IN_FRAMES, FPS, HEIGHT, WIDTH } from "./constants";
import { LedLightWall } from "./led/LedLightWall";
import { PALETTE_REFERENCE, PALETTE_SUNSET } from "./led/palettes";

export const RemotionRoot: React.FC = () => {
  return (
    <>
      {/* Version 1: matches the reference (violet -> cyan LED wall). */}
      <Composition
        id="LedWall-V1-Reference-4K"
        component={LedLightWall}
        durationInFrames={DURATION_IN_FRAMES}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
        defaultProps={{ palette: PALETTE_REFERENCE }}
      />
      {/* Version 2: alternative colour palette (magenta -> amber). */}
      <Composition
        id="LedWall-V2-SunsetPalette-4K"
        component={LedLightWall}
        durationInFrames={DURATION_IN_FRAMES}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
        defaultProps={{ palette: PALETTE_SUNSET }}
      />
    </>
  );
};
