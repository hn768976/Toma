import { Composition } from "remotion";
import { EmbossCircles } from "./emboss/EmbossCircles";
import { MIDNIGHT_COPPER, PAPER_WHITE } from "./emboss/palettes";

// Master compositions are authored in 4K UHD. Deliverables are rendered at
// 1080p with `--scale=0.5` (see README).
export const WIDTH = 3840;
export const HEIGHT = 2160;
export const FPS = 30;
// The reference is 270 frames long (9.009 s @ 29.97 fps). At exactly 30 fps
// the same 270 frames last 9.000 s — the closest frame-accurate match.
export const DURATION_IN_FRAMES = 270;

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="EmbossCircles-V1-Match"
        component={EmbossCircles}
        durationInFrames={DURATION_IN_FRAMES}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
        defaultProps={{ palette: PAPER_WHITE }}
      />
      <Composition
        id="EmbossCircles-V2-MidnightCopper"
        component={EmbossCircles}
        durationInFrames={DURATION_IN_FRAMES}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
        defaultProps={{ palette: MIDNIGHT_COPPER }}
      />
    </>
  );
};
