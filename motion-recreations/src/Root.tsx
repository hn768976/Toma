import { Composition, Folder } from "remotion";
import { DotGridMidnight, DotGridReference } from "./dotgrid";
import { DURATION_IN_FRAMES, FPS, HEIGHT, WIDTH } from "./shared/constants";
import { VortexFieldFlyover, VortexFieldReference } from "./vortex/VortexField";

const shared = {
  durationInFrames: DURATION_IN_FRAMES,
  fps: FPS,
  width: WIDTH,
  height: HEIGHT,
};

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Folder name="Composition1-DotGrid">
        <Composition
          id="C1-V1-DotGrid"
          component={DotGridReference}
          {...shared}
        />
        <Composition
          id="C1-V2-DotGrid-Midnight"
          component={DotGridMidnight}
          {...shared}
        />
      </Folder>
      <Folder name="Composition2-VortexField">
        <Composition
          id="C2-V1-VortexField"
          component={VortexFieldReference}
          {...shared}
        />
        <Composition
          id="C2-V2-VortexField-Flyover"
          component={VortexFieldFlyover}
          {...shared}
        />
      </Folder>
    </>
  );
};
