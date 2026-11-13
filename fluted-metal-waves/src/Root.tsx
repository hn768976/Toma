import { Composition } from "remotion";
import { FlutedMetalWaves } from "./FlutedMetalWaves";
import { DURATION_IN_FRAMES, FPS, HEIGHT, WIDTH } from "./constants";

export const RemotionRoot: React.FC = () => {
  return (
    <>
      {/* Version 1 - matches the reference: silver / chrome */}
      <Composition
        id="FlutedMetalWaves-V1-Silver"
        component={FlutedMetalWaves}
        durationInFrames={DURATION_IN_FRAMES}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
        defaultProps={{ palette: "silver" as const }}
      />
      {/* Version 2 - alternative colour palette: warm gold */}
      <Composition
        id="FlutedMetalWaves-V2-Gold"
        component={FlutedMetalWaves}
        durationInFrames={DURATION_IN_FRAMES}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
        defaultProps={{ palette: "gold" as const }}
      />
    </>
  );
};
