import { Composition } from "remotion";
import { DURATION_IN_FRAMES, FPS, HEIGHT, WIDTH } from "./config";
import { MarketField } from "./MarketField";
import { GREEN_RED, VIOLET } from "./palettes";

/**
 * Both compositions are defined at 3840x2160 so the same source renders a 4K
 * master and, with `--scale=0.5`, a 1080p preview.
 */
export const RemotionRoot: React.FC = () => (
  <>
    <Composition
      id="V1-MarketFieldViolet"
      component={MarketField}
      durationInFrames={DURATION_IN_FRAMES}
      fps={FPS}
      width={WIDTH}
      height={HEIGHT}
      defaultProps={{ palette: VIOLET }}
    />
    <Composition
      id="V2-MarketFieldGreenRed"
      component={MarketField}
      durationInFrames={DURATION_IN_FRAMES}
      fps={FPS}
      width={WIDTH}
      height={HEIGHT}
      defaultProps={{ palette: GREEN_RED }}
    />
  </>
);
