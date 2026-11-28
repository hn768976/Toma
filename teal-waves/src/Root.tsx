import { Composition } from "remotion";
import { DURATION_IN_FRAMES, FPS, HEIGHT, MOMENTS, Moment, WIDTH } from "./config";
import { Waves, WavesProps } from "./Waves";

type LookDevProps = WavesProps & { moment: Moment };

/** Still used for look development: one of the three key moments. */
const LookDev: React.FC<LookDevProps> = ({ moment, palette }) => (
  <Waves palette={palette} frameOverride={MOMENTS[moment]} />
);

export const RemotionRoot: React.FC = () => (
  <>
    <Composition
      id="V1-teal-waves"
      component={Waves}
      durationInFrames={DURATION_IN_FRAMES}
      fps={FPS}
      width={WIDTH}
      height={HEIGHT}
      defaultProps={{ palette: "teal" } satisfies WavesProps}
    />
    <Composition
      id="V2-teal-waves"
      component={Waves}
      durationInFrames={DURATION_IN_FRAMES}
      fps={FPS}
      width={WIDTH}
      height={HEIGHT}
      defaultProps={{ palette: "ember" } satisfies WavesProps}
    />
    <Composition
      id="LookDev"
      component={LookDev}
      durationInFrames={1}
      fps={FPS}
      width={WIDTH}
      height={HEIGHT}
      defaultProps={{ moment: "middle", palette: "teal" } satisfies LookDevProps}
    />
  </>
);
