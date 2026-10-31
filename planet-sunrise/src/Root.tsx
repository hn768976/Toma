import { Composition } from "remotion";
import { DURATION_IN_FRAMES, FPS, HEIGHT, WIDTH } from "./constants";
import { PlanetSunrise } from "./planet/PlanetSunrise";

export const RemotionRoot: React.FC = () => {
  return (
    <>
      {/* Version 1: matches the reference (locked-off camera). */}
      <Composition
        id="PlanetSunrise-V1-Reference-4K"
        component={PlanetSunrise}
        durationInFrames={DURATION_IN_FRAMES}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
        defaultProps={{ camera: "static" as const }}
      />
      {/* Version 2: alternative camera move (push-in + roll, with parallax). */}
      <Composition
        id="PlanetSunrise-V2-CameraMove-4K"
        component={PlanetSunrise}
        durationInFrames={DURATION_IN_FRAMES}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
        defaultProps={{ camera: "dolly-roll" as const }}
      />
    </>
  );
};
