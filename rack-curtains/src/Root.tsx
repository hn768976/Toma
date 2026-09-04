import { Composition } from "remotion";
import {
  RackCurtains,
  rackCurtainsSchema,
  rackCurtainsDefaults,
} from "./RackCurtains";
import { DURATION_IN_FRAMES, FPS, HEIGHT, WIDTH } from "./constants";
import { V1_CYAN, V2_MAGENTA } from "./palette";

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="V1-RackCurtainsCyan"
        component={RackCurtains}
        durationInFrames={DURATION_IN_FRAMES}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
        schema={rackCurtainsSchema}
        defaultProps={{ ...rackCurtainsDefaults, palette: V1_CYAN }}
      />
      <Composition
        id="V2-RackCurtainsMagenta"
        component={RackCurtains}
        durationInFrames={DURATION_IN_FRAMES}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
        schema={rackCurtainsSchema}
        defaultProps={{ ...rackCurtainsDefaults, palette: V2_MAGENTA }}
      />
    </>
  );
};
