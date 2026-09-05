import { Composition } from "remotion";
import {
  ParticleDunes,
  particleDunesSchema,
  particleDunesDefaults,
} from "./particle-dunes/ParticleDunes";
import {
  BASE_WIDTH,
  BASE_HEIGHT,
  DURATION_IN_FRAMES,
  FPS,
} from "./particle-dunes/constants";

// Both compositions are defined at 3840x2160 so they can be rendered at 4K.
// The 1080p preview is the same composition rendered with --scale=0.5.
export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="ParticleDunesCyan"
        component={ParticleDunes}
        durationInFrames={DURATION_IN_FRAMES}
        fps={FPS}
        width={BASE_WIDTH}
        height={BASE_HEIGHT}
        schema={particleDunesSchema}
        defaultProps={particleDunesDefaults}
      />
      <Composition
        id="ParticleDunesSand"
        component={ParticleDunes}
        durationInFrames={DURATION_IN_FRAMES}
        fps={FPS}
        width={BASE_WIDTH}
        height={BASE_HEIGHT}
        schema={particleDunesSchema}
        defaultProps={{ ...particleDunesDefaults, palette: "sand" }}
      />
    </>
  );
};
