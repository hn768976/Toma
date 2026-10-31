import { Composition } from "remotion";
import { PlexusSphere, plexusSchema } from "./plexus/PlexusSphere";

// Both compositions are authored at native 4K UHD (3840×2160), 30 fps,
// 600 frames = exactly 20.000 s (reference duration).
const W = 3840;
const H = 2160;
const FPS = 30;
const FRAMES = 600;

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="PlexusSphere-V1-Reference"
        component={PlexusSphere}
        schema={plexusSchema}
        durationInFrames={FRAMES}
        fps={FPS}
        width={W}
        height={H}
        defaultProps={{ palette: "reference" as const, seed: 20260 }}
      />
      <Composition
        id="PlexusSphere-V2-Midnight"
        component={PlexusSphere}
        schema={plexusSchema}
        durationInFrames={FRAMES}
        fps={FPS}
        width={W}
        height={H}
        defaultProps={{ palette: "midnight" as const, seed: 20260 }}
      />
    </>
  );
};
