import { Composition } from "remotion";
import { CoralBlobs } from "./CoralBlobs";
import {
  DURATION_IN_FRAMES,
  FPS,
  HEIGHT_4K,
  WIDTH_4K,
  coralV1,
  coralV2,
} from "./presets";

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="CoralBlobs-V1-4K"
        component={CoralBlobs}
        durationInFrames={DURATION_IN_FRAMES}
        fps={FPS}
        width={WIDTH_4K}
        height={HEIGHT_4K}
        defaultProps={coralV1}
      />
      <Composition
        id="CoralBlobs-V2-4K"
        component={CoralBlobs}
        durationInFrames={DURATION_IN_FRAMES}
        fps={FPS}
        width={WIDTH_4K}
        height={HEIGHT_4K}
        defaultProps={coralV2}
      />
    </>
  );
};
