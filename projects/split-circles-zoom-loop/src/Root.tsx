import { Composition } from "remotion";
import { DURATION_IN_FRAMES, FPS, HEIGHT_4K, WIDTH_4K } from "./circles/constants";
import { SplitCircles } from "./circles/SplitCircles";

export const RemotionRoot: React.FC = () => {
  return (
    <>
      {/* Version 1 - matches the reference (violet / pink palette) */}
      <Composition
        id="SplitCircles-V1-Match-4K"
        component={SplitCircles}
        durationInFrames={DURATION_IN_FRAMES}
        fps={FPS}
        width={WIDTH_4K}
        height={HEIGHT_4K}
        defaultProps={{ palette: "violet" as const }}
      />
      {/* Version 2 - alternative colour palette (cobalt / aqua) */}
      <Composition
        id="SplitCircles-V2-CobaltAqua-4K"
        component={SplitCircles}
        durationInFrames={DURATION_IN_FRAMES}
        fps={FPS}
        width={WIDTH_4K}
        height={HEIGHT_4K}
        defaultProps={{ palette: "cobalt" as const }}
      />
    </>
  );
};
