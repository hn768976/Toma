import { Composition, Folder } from "remotion";
import { NetworkMap } from "./NetworkMap";

// Native 4K UHD compositions. Deliverables are rendered at 1080p with --scale=0.5
// (supersampled from the 4K frame), see README.
const FPS = 30;
const DURATION_FRAMES = 900; // 30.000 s — identical to the reference clip

export const RemotionRoot: React.FC = () => {
  return (
    <Folder name="Composition1-GlobalNetworkMap">
      <Composition
        id="NetworkMap-V1-Reference"
        component={NetworkMap}
        durationInFrames={DURATION_FRAMES}
        fps={FPS}
        width={3840}
        height={2160}
        defaultProps={{ palette: "blue" }}
      />
      <Composition
        id="NetworkMap-V2-AmberPalette"
        component={NetworkMap}
        durationInFrames={DURATION_FRAMES}
        fps={FPS}
        width={3840}
        height={2160}
        defaultProps={{ palette: "amber" }}
      />
    </Folder>
  );
};
