import { Composition } from "remotion";
import { GlassCubeRing } from "./GlassCubeRing";
import { RING_FRAMES } from "./scenes/glassRing";

// Master compositions are authored at 4K UHD. Deliverables are rendered from
// these same compositions with `--scale=0.5` (1920x1080).
const W = 3840;
const H = 2160;

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="GlassCubeRing-V1"
        component={GlassCubeRing}
        durationInFrames={RING_FRAMES}
        fps={30}
        width={W}
        height={H}
        defaultProps={{ variant: "match" as const }}
      />
      <Composition
        id="GlassCubeRing-V2"
        component={GlassCubeRing}
        durationInFrames={RING_FRAMES}
        fps={30}
        width={W}
        height={H}
        defaultProps={{ variant: "alt" as const }}
      />
    </>
  );
};
