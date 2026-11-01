import { Composition, Folder } from "remotion";
import { PinField, pinFieldSchema } from "./pins/PinField";

// 4K UHD compositions. Final 1080p deliverables are rendered with --scale=0.5
// (see README), which downsamples the full 4K frame.
const WIDTH = 3840;
const HEIGHT = 2160;
const FPS = 30;
// Reference clip: 270 frames (9.009 s @ 29.97 fps) -> 270 frames @ 30 fps.
const DURATION = 270;
const LOOP = 90; // the reference wave pattern repeats every 90 frames (3 s)

export const RemotionRoot: React.FC = () => {
  return (
    <Folder name="Pin-Field-Waves">
      <Composition
        id="PinField-V1-4K"
        component={PinField}
        schema={pinFieldSchema}
        durationInFrames={DURATION}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
        defaultProps={{ camera: "reference" as const, loopFrames: LOOP }}
      />
      <Composition
        id="PinField-V2-4K"
        component={PinField}
        schema={pinFieldSchema}
        durationInFrames={DURATION}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
        defaultProps={{ camera: "orbit-crane" as const, loopFrames: LOOP }}
      />
    </Folder>
  );
};
