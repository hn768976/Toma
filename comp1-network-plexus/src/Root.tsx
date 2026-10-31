import { Composition } from "remotion";
import { DURATION_FRAMES, FPS } from "./network/build";
import { NetworkPlexus } from "./network/NetworkPlexus";

// Composition 1 – "Network Plexus" data-network fly-through.
// Authored at 4K UHD (3840x2160), 30 fps, 650 frames (21.667 s) to match the
// reference clip exactly.
export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="NetworkPlexus-V1"
        component={NetworkPlexus}
        fps={FPS}
        durationInFrames={DURATION_FRAMES}
        width={3840}
        height={2160}
        defaultProps={{ variant: "v1" as const }}
      />
      <Composition
        id="NetworkPlexus-V2"
        component={NetworkPlexus}
        fps={FPS}
        durationInFrames={DURATION_FRAMES}
        width={3840}
        height={2160}
        defaultProps={{ variant: "v2" as const }}
      />
    </>
  );
};
