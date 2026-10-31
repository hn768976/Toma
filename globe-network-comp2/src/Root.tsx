import { Composition, Folder } from "remotion";
import { EarthNetwork } from "./EarthNetwork";

// Native 4K UHD compositions. Deliverables are rendered at 1080p with --scale=0.5
// (supersampled from the 4K frame), see README.
const FPS = 30;
const DURATION_FRAMES = 900; // 30.000 s — identical to the reference clip

export const RemotionRoot: React.FC = () => {
  return (
    <Folder name="Composition2-EarthNetwork">
      <Composition
        id="EarthNetwork-V1-Reference"
        component={EarthNetwork}
        durationInFrames={DURATION_FRAMES}
        fps={FPS}
        width={3840}
        height={2160}
        defaultProps={{ variant: "reference" as const }}
      />
      <Composition
        id="EarthNetwork-V2-OrbitalPullback"
        component={EarthNetwork}
        durationInFrames={DURATION_FRAMES}
        fps={FPS}
        width={3840}
        height={2160}
        defaultProps={{ variant: "orbital" as const }}
      />
    </Folder>
  );
};
