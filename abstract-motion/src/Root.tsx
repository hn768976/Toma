import "./index.css";
import { Composition } from "remotion";
import { QuestionField } from "./question-field/QuestionField";
import { ColorBurst } from "./color-burst/ColorBurst";

// All compositions are authored at 4K UHD. Deliverables are rendered at
// 1080p with `--scale=0.5` (see README).
const WIDTH = 3840;
const HEIGHT = 2160;
const FPS = 30;

// Reference A: 8.00 s -> 240 frames.
const QUESTION_FIELD_FRAMES = 240;
// Reference B: 10.04 s (251 frames @ 25 fps) -> 301 frames @ 30 fps
// (10.033 s, the closest whole-frame duration).
const COLOR_BURST_FRAMES = 301;

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="QuestionField-V1"
        component={QuestionField}
        durationInFrames={QUESTION_FIELD_FRAMES}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
        defaultProps={{ variant: "reference" as const }}
      />
      <Composition
        id="QuestionField-V2"
        component={QuestionField}
        durationInFrames={QUESTION_FIELD_FRAMES}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
        defaultProps={{ variant: "orbit" as const }}
      />
      <Composition
        id="ColorBurst-V1"
        component={ColorBurst}
        durationInFrames={COLOR_BURST_FRAMES}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
        defaultProps={{ variant: "reference" as const }}
      />
      <Composition
        id="ColorBurst-V2"
        component={ColorBurst}
        durationInFrames={COLOR_BURST_FRAMES}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
        defaultProps={{ variant: "solar" as const }}
      />
    </>
  );
};
