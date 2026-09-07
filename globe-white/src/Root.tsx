import { Composition } from "remotion";
import {
  GlobeWhite,
  globeWhiteSchema,
  globeWhiteDefaults,
} from "./globe/GlobeWhite";
import {
  WIDTH,
  HEIGHT,
  FPS,
  DURATION_IN_FRAMES,
} from "./globe/constants";

/**
 * Both compositions are authored at 3840x2160 so they can be rendered at 4K
 * later. Render the preview with --scale=0.5 for 1920x1080.
 */
export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="V1-GlobeWhiteMono"
        component={GlobeWhite}
        durationInFrames={DURATION_IN_FRAMES}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
        schema={globeWhiteSchema}
        defaultProps={globeWhiteDefaults}
      />
      <Composition
        id="V2-GlobeWhiteBlue"
        component={GlobeWhite}
        durationInFrames={DURATION_IN_FRAMES}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
        schema={globeWhiteSchema}
        defaultProps={{ ...globeWhiteDefaults, variant: "blue" }}
      />
    </>
  );
};
