import { Composition } from "remotion";
import { FlowField } from "./flow-field/FlowField";
import {
  BASE_HEIGHT,
  BASE_WIDTH,
  DURATION_IN_FRAMES,
  FPS,
} from "./flow-field/constants";

/**
 * Both compositions are defined at 3840x2160 and are rendered at whatever scale
 * is asked for, so `--scale=0.5` gives an exact 1080p preview of the 4K master.
 */
export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="V1-FlowFieldBlue"
        component={FlowField}
        durationInFrames={DURATION_IN_FRAMES}
        fps={FPS}
        width={BASE_WIDTH}
        height={BASE_HEIGHT}
        defaultProps={{ palette: "blue" as const, fieldSeed: 20260904 }}
      />
      <Composition
        id="V2-FlowFieldEmerald"
        component={FlowField}
        durationInFrames={DURATION_IN_FRAMES}
        fps={FPS}
        width={BASE_WIDTH}
        height={BASE_HEIGHT}
        defaultProps={{ palette: "emerald" as const, fieldSeed: 71144822 }}
      />
    </>
  );
};
