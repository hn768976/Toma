import { Composition } from "remotion";
import { ArchiveCorridor } from "./archive/ArchiveCorridor";
import {
  MoonlitSea,
  REFERENCE_PALETTE,
  TEAL_AMBER_PALETTE,
} from "./moonlit/MoonlitSea";

// All compositions are authored at 4K UHD. Render 1080p deliverables with
// `--scale=0.5` (see README) or downscale the 4K masters.
const WIDTH = 3840;
const HEIGHT = 2160;
const FPS = 30;
// Both reference clips are exactly 10.000 s (300 frames at 30 fps).
const DURATION = 300;

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="MoonlitSea-V1-Reference"
        component={MoonlitSea}
        durationInFrames={DURATION}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
        defaultProps={{ palette: REFERENCE_PALETTE }}
      />
      <Composition
        id="MoonlitSea-V2-TealAmber"
        component={MoonlitSea}
        durationInFrames={DURATION}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
        defaultProps={{ palette: TEAL_AMBER_PALETTE }}
      />
      <Composition
        id="ArchiveCorridor-V1-Reference"
        component={ArchiveCorridor}
        durationInFrames={DURATION}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
        defaultProps={{ cameraMode: "reference" as const }}
      />
      <Composition
        id="ArchiveCorridor-V2-DollyZoomRoll"
        component={ArchiveCorridor}
        durationInFrames={DURATION}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
        defaultProps={{ cameraMode: "dollyZoomRoll" as const }}
      />
    </>
  );
};
