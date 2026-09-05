import { Composition } from "remotion";
import { LineMesh } from "./LineMesh";
import { BLUE, COPPER } from "./palettes";
import { DURATION_IN_FRAMES, FPS, HEIGHT, WIDTH } from "./constants";

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="V1-LineMeshBlue"
        component={LineMesh}
        durationInFrames={DURATION_IN_FRAMES}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
        defaultProps={{ palette: BLUE }}
      />
      <Composition
        id="V2-LineMeshCopper"
        component={LineMesh}
        durationInFrames={DURATION_IN_FRAMES}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
        defaultProps={{ palette: COPPER }}
      />
    </>
  );
};
