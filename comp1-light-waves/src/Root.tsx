import "./index.css";
import { Composition } from "remotion";
import { LightWaves } from "./light-waves/LightWaves";
import { DURATION_IN_FRAMES, FPS, HEIGHT, WIDTH } from "./light-waves/constants";
import { bluePalette, emberPalette } from "./light-waves/palettes";

export const RemotionRoot: React.FC = () => {
  return (
    <>
      {/* Version 1: matches the reference (electric blue). */}
      <Composition
        id="LightWaves-V1"
        component={LightWaves}
        durationInFrames={DURATION_IN_FRAMES}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
        defaultProps={{ palette: bluePalette, camera: { focus: 5.2, aperture: 16 } }}
      />
      {/* Version 2: same scene and camera, alternative "ember" color palette. */}
      <Composition
        id="LightWaves-V2"
        component={LightWaves}
        durationInFrames={DURATION_IN_FRAMES}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
        defaultProps={{ palette: emberPalette, camera: { focus: 5.2, aperture: 16 } }}
      />
    </>
  );
};
