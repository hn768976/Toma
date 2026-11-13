import { Composition } from "remotion";
import { BrainScene } from "./brain/BrainScene";
import { emberPalette, referencePalette } from "./brain/palettes";

// Both compositions are authored at 4K UHD (3840x2160), 30 fps, 300 frames
// (exactly 10.000 s — the length of the reference clip).
const W = 3840;
const H = 2160;
const FPS = 30;
const FRAMES = 300;

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="BrainFormationV1"
        component={BrainScene}
        durationInFrames={FRAMES}
        fps={FPS}
        width={W}
        height={H}
        defaultProps={{ palette: referencePalette }}
      />
      <Composition
        id="BrainFormationV2"
        component={BrainScene}
        durationInFrames={FRAMES}
        fps={FPS}
        width={W}
        height={H}
        defaultProps={{ palette: emberPalette }}
      />
    </>
  );
};
