import { Composition } from "remotion";
import { GlitchCollage } from "./GlitchCollage";
import { ALT_PALETTE, REFERENCE_PALETTE } from "./lib/palettes";

// Reference clip: 237 frames @ 30 fps (7.9 s). Authored at 4K UHD.
const FPS = 30;
const DURATION = 237;
const WIDTH = 3840;
const HEIGHT = 2160;

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="GlitchCollage-Reference"
        component={GlitchCollage}
        durationInFrames={DURATION}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
        defaultProps={{ palette: REFERENCE_PALETTE, seed: 7 }}
      />
      <Composition
        id="GlitchCollage-Amber"
        component={GlitchCollage}
        durationInFrames={DURATION}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
        defaultProps={{ palette: ALT_PALETTE, seed: 7 }}
      />
    </>
  );
};
