import { Composition } from "remotion";
import { ToggleField, toggleFieldSchema } from "./ToggleField";

// 4K UHD compositions. Reference clip: 10.677 s -> 320 frames @ 30 fps.
export const WIDTH = 3840;
export const HEIGHT = 2160;
export const FPS = 30;
export const DURATION_IN_FRAMES = 320;

export const RemotionRoot: React.FC = () => {
  return (
    <>
      {/* Version 1 – matches the reference: flat top-down view, diagonal drift */}
      <Composition
        id="ToggleField-V1"
        component={ToggleField}
        durationInFrames={DURATION_IN_FRAMES}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
        schema={toggleFieldSchema}
        defaultProps={{ camera: "top-down" as const, seed: 7, pixelRatio: 1 }}
      />
      {/* Version 2 – same world, tilted orbiting / dollying camera */}
      <Composition
        id="ToggleField-V2"
        component={ToggleField}
        durationInFrames={DURATION_IN_FRAMES}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
        schema={toggleFieldSchema}
        defaultProps={{ camera: "orbit" as const, seed: 7, pixelRatio: 1 }}
      />
    </>
  );
};
