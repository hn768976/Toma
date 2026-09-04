import { Composition } from "remotion";
import { AIHologram } from "./AIHologram";
import { DURATION_IN_FRAMES, FPS, HEIGHT, WIDTH } from "./config";

/**
 * Both versions are defined at 3840x2160 so they can be rendered at 4K later;
 * the preview pass uses --scale=0.5. Geometry is identical between them — only
 * the palette differs.
 */
export const RemotionRoot: React.FC = () => (
  <>
    <Composition
      id="V1-AIHologramDarkBlue"
      component={AIHologram}
      durationInFrames={DURATION_IN_FRAMES}
      fps={FPS}
      width={WIDTH}
      height={HEIGHT}
      defaultProps={{ palette: "dark-blue" }}
    />
    <Composition
      id="V2-AIHologramDarkCyan"
      component={AIHologram}
      durationInFrames={DURATION_IN_FRAMES}
      fps={FPS}
      width={WIDTH}
      height={HEIGHT}
      defaultProps={{ palette: "dark-cyan" }}
    />
  </>
);
