import { Composition, Folder } from "remotion";
import { EarthCountdown, EarthCountdownProps } from "./earth/EarthCountdown";
import { DURATION_IN_FRAMES, FPS } from "./earth/timeline";

// Reference clip: 29.666… s @ 30 fps = 890 frames. Compositions are authored in 4K UHD.
export const WIDTH = 3840;
export const HEIGHT = 2160;

export const RemotionRoot: React.FC = () => {
  return (
    <Folder name="Earth-Network-Countdown-4K">
      <Composition
        id="EarthCountdown-V1-Sunrise"
        component={EarthCountdown}
        durationInFrames={DURATION_IN_FRAMES}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
        defaultProps={{ variant: "sunrise" } satisfies EarthCountdownProps}
      />
      <Composition
        id="EarthCountdown-V2-AuroraPalette"
        component={EarthCountdown}
        durationInFrames={DURATION_IN_FRAMES}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
        defaultProps={{ variant: "aurora" } satisfies EarthCountdownProps}
      />
    </Folder>
  );
};
