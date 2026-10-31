import { Composition, Folder } from "remotion";
import {
  SilkFlow,
  silkFlowSchema,
  silkV1Defaults,
  silkV2Defaults,
} from "./silk/SilkFlow";

// 4K UHD master compositions. Reference clip: 360 frames (12.012 s @ 29.97).
// At exactly 30 fps we keep the same 360 frames -> 12.000 s.
const WIDTH = 3840;
const HEIGHT = 2160;
const FPS = 30;
const DURATION_IN_FRAMES = 360;

export const RemotionRoot: React.FC = () => {
  return (
    <Folder name="Silk-Flow-4K">
      <Composition
        id="SilkFlowV1"
        component={SilkFlow}
        schema={silkFlowSchema}
        defaultProps={silkV1Defaults}
        durationInFrames={DURATION_IN_FRAMES}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
      />
      <Composition
        id="SilkFlowV2"
        component={SilkFlow}
        schema={silkFlowSchema}
        defaultProps={silkV2Defaults}
        durationInFrames={DURATION_IN_FRAMES}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
      />
    </Folder>
  );
};
