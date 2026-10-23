import { Composition } from "remotion";
import {
  CLOUDS_DURATION,
  FPS,
  HEIGHT,
  UNDERWATER_DURATION,
  WIDTH,
} from "./lib/constants";
import { UnderwaterRays } from "./underwater/UnderwaterRays";
import { LAGOON_GOLD, OCEAN_BLUE } from "./underwater/palettes";
import { MoonlitClouds } from "./clouds/MoonlitClouds";
import { MOONLIGHT } from "./clouds/palettes";

// Every composition is 3840x2160 @ 30 fps. Deliverables are rendered at
// 1920x1080 with `--scale=0.5` (see README / package.json scripts).
export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="Underwater-V1"
        component={UnderwaterRays}
        durationInFrames={UNDERWATER_DURATION}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
        defaultProps={{ palette: OCEAN_BLUE }}
      />
      <Composition
        id="Underwater-V2"
        component={UnderwaterRays}
        durationInFrames={UNDERWATER_DURATION}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
        defaultProps={{ palette: LAGOON_GOLD }}
      />
      <Composition
        id="MoonClouds-V1"
        component={MoonlitClouds}
        durationInFrames={CLOUDS_DURATION}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
        defaultProps={{ shotId: "glide" as const, palette: MOONLIGHT }}
      />
      <Composition
        id="MoonClouds-V2"
        component={MoonlitClouds}
        durationInFrames={CLOUDS_DURATION}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
        defaultProps={{ shotId: "banking-rise" as const, palette: MOONLIGHT }}
      />
    </>
  );
};
