import "./index.css";
import { Composition } from "remotion";
import { TEAL_PRINT } from "./ribbons/palettes";
import { StringRibbons } from "./ribbons/StringRibbons";

// Reference clip: 360 frames (12.012 s @ 29.97) -> 360 frames @ 30 fps.
export const DURATION_IN_FRAMES = 360;
export const FPS = 30;
export const WIDTH = 3840;
export const HEIGHT = 2160;

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="Ribbons-V1-4K"
        component={StringRibbons}
        durationInFrames={DURATION_IN_FRAMES}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
        defaultProps={{ rig: "closeOrbit" as const, palette: TEAL_PRINT }}
      />
      <Composition
        id="Ribbons-V2-4K"
        component={StringRibbons}
        durationInFrames={DURATION_IN_FRAMES}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
        defaultProps={{ rig: "wideCrane" as const, palette: TEAL_PRINT }}
      />
    </>
  );
};
