import { Composition } from "remotion";
import { NeuronField } from "./scene/NeuronField";
import {
  DURATION_IN_FRAMES,
  FPS,
  HEIGHT,
  LOOKS,
  WIDTH,
} from "./looks/looks";

/**
 * Eleven compositions from six looks, all driven by the same component.
 * Defined at 3840x2160; render previews with `--scale=0.5` for 1920x1080.
 */
export const RemotionRoot: React.FC = () => {
  return (
    <>
      {LOOKS.map((look) => (
        <Composition
          key={look.id}
          id={look.id}
          component={NeuronField}
          durationInFrames={DURATION_IN_FRAMES}
          fps={FPS}
          width={WIDTH}
          height={HEIGHT}
          defaultProps={{ look }}
        />
      ))}
    </>
  );
};
