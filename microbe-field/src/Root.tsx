import { Composition } from "remotion";
import { MicrobeField } from "./microbes/MicrobeField";
import { brightfield, fluorescence } from "./microbes/palettes";

// Reference clip: 30.03 s. At exactly 30 fps the closest frame count is 901
// (30.033 s, within one frame of the reference).
const DURATION_IN_FRAMES = 901;

// 4K UHD masters; deliverables are rendered from these with --scale=0.5.
const WIDTH = 3840;
const HEIGHT = 2160;

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="MicrobeField-V1-Brightfield"
        component={MicrobeField}
        durationInFrames={DURATION_IN_FRAMES}
        fps={30}
        width={WIDTH}
        height={HEIGHT}
        defaultProps={{ palette: brightfield }}
      />
      <Composition
        id="MicrobeField-V2-Fluorescence"
        component={MicrobeField}
        durationInFrames={DURATION_IN_FRAMES}
        fps={30}
        width={WIDTH}
        height={HEIGHT}
        defaultProps={{ palette: fluorescence }}
      />
    </>
  );
};
