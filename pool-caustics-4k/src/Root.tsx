import { Composition, Folder } from "remotion";
import {
  PoolCaustics,
  poolCausticsSchema,
  poolV1Defaults,
  poolV2Defaults,
} from "./pool/PoolCaustics";

// 4K UHD master compositions. Reference clip: 300 frames (10.010 s @ 29.97).
// At exactly 30 fps we keep the same 300 frames -> 10.000 s.
const WIDTH = 3840;
const HEIGHT = 2160;
const FPS = 30;
const DURATION_IN_FRAMES = 300;

export const RemotionRoot: React.FC = () => {
  return (
    <Folder name="Pool-Caustics-4K">
      <Composition
        id="PoolCausticsV1"
        component={PoolCaustics}
        schema={poolCausticsSchema}
        defaultProps={poolV1Defaults}
        durationInFrames={DURATION_IN_FRAMES}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
      />
      <Composition
        id="PoolCausticsV2"
        component={PoolCaustics}
        schema={poolCausticsSchema}
        defaultProps={poolV2Defaults}
        durationInFrames={DURATION_IN_FRAMES}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
      />
    </Folder>
  );
};
