import { Composition } from "remotion";
import { DURATION_IN_FRAMES, FPS, HEIGHT, WIDTH } from "./constants";
import { ServerCorridor, serverCorridorSchema } from "./corridor/ServerCorridor";

// Two 4K versions of the same dolly shot down a server-room aisle:
// - ServerCorridor4K: matches the reference (white hall, white LEDs)
// - ServerCorridorMidnight4K: same camera, night-mode palette
export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="ServerCorridor4K"
        component={ServerCorridor}
        durationInFrames={DURATION_IN_FRAMES}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
        schema={serverCorridorSchema}
        defaultProps={{ paletteName: "reference" as const, ledBoost: 1.0, vignetteColor: "#000000" }}
      />
      <Composition
        id="ServerCorridorMidnight4K"
        component={ServerCorridor}
        durationInFrames={DURATION_IN_FRAMES}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
        schema={serverCorridorSchema}
        defaultProps={{ paletteName: "midnight" as const, ledBoost: 1.4, vignetteColor: "#000000" }}
      />
    </>
  );
};
