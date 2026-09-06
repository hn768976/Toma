import { Composition } from "remotion";
import {
  DURATION_IN_FRAMES,
  FPS,
  HEIGHT,
  WIDTH,
} from "./plexus/constants";
import { PlexusWhite } from "./plexus/PlexusWhite";

// Both compositions are defined at 3840x2160 so they can be rendered at full
// 4K later; the 1080p preview is the same composition at `--scale=0.5`.
export const RemotionRoot: React.FC = () => (
  <>
    <Composition
      id="V1-PlexusWhiteMono"
      component={PlexusWhite}
      durationInFrames={DURATION_IN_FRAMES}
      fps={FPS}
      width={WIDTH}
      height={HEIGHT}
      defaultProps={{ accent: false, seed: 20260906 }}
    />
    <Composition
      id="V2-PlexusWhiteBlue"
      component={PlexusWhite}
      durationInFrames={DURATION_IN_FRAMES}
      fps={FPS}
      width={WIDTH}
      height={HEIGHT}
      defaultProps={{ accent: true, seed: 20260906 }}
    />
  </>
);
