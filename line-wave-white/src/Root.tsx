import { Composition } from "remotion";
import {
  COMP_HEIGHT,
  COMP_WIDTH,
  DURATION_IN_FRAMES,
  FPS,
  PALETTE_BLUE,
  PALETTE_GRAPHITE,
} from "./constants";
import { LineWave } from "./LineWave";

/**
 * Both compositions are defined at 3840x2160 so they can be rendered at 4K.
 * Everything in the scene is sized in world units or in composition pixels, so
 * a `--scale=0.5` preview is a true downscale of the 4K frame rather than a
 * differently proportioned picture.
 */
export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="V1-LineWaveWhiteBlue"
        component={LineWave}
        durationInFrames={DURATION_IN_FRAMES}
        fps={FPS}
        width={COMP_WIDTH}
        height={COMP_HEIGHT}
        defaultProps={{ palette: PALETTE_BLUE, grainOpacity: 1 }}
      />
      <Composition
        id="V2-LineWaveWhiteGraphite"
        component={LineWave}
        durationInFrames={DURATION_IN_FRAMES}
        fps={FPS}
        width={COMP_WIDTH}
        height={COMP_HEIGHT}
        defaultProps={{ palette: PALETTE_GRAPHITE, grainOpacity: 1 }}
      />
    </>
  );
};
