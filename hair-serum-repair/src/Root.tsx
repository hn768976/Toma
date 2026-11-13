import { Composition } from "remotion";
import { HairSerum } from "./HairSerum";

// Reference clip: 251 frames at 30 fps (8.3667 s).
const FPS = 30;
const DURATION_IN_FRAMES = 251;
const WIDTH = 3840;
const HEIGHT = 2160;

export const RemotionRoot: React.FC = () => {
  return (
    <>
      {/* Version 1 – faithful match of the reference (gold serum, slate backdrop) */}
      <Composition
        id="HairSerum-V1-4K"
        component={HairSerum}
        durationInFrames={DURATION_IN_FRAMES}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
        defaultProps={{ variant: "v1" as const }}
      />
      {/* Version 2 – same shot, alternative colour palette (rose serum, plum backdrop) */}
      <Composition
        id="HairSerum-V2-4K"
        component={HairSerum}
        durationInFrames={DURATION_IN_FRAMES}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
        defaultProps={{ variant: "v2" as const }}
      />
    </>
  );
};
