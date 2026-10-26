import { Composition } from "remotion";
import { SmokeBurst } from "./SmokeBurst";
import { DURATION_IN_FRAMES, FPS, HEIGHT_4K, WIDTH_4K, smokeV1, smokeV2 } from "./presets";

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="SmokeBurst-V1-4K"
        component={SmokeBurst}
        durationInFrames={DURATION_IN_FRAMES}
        fps={FPS}
        width={WIDTH_4K}
        height={HEIGHT_4K}
        defaultProps={smokeV1}
      />
      <Composition
        id="SmokeBurst-V2-4K"
        component={SmokeBurst}
        durationInFrames={DURATION_IN_FRAMES}
        fps={FPS}
        width={WIDTH_4K}
        height={HEIGHT_4K}
        defaultProps={smokeV2}
      />
    </>
  );
};
