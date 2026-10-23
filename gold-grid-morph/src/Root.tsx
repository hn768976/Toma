import { Composition } from "remotion";
import { GoldGridMorph } from "./GoldGridMorph";
import { GRID_FRAMES } from "./scenes/goldGrid";

// Master compositions are authored at 4K UHD. Deliverables are rendered from
// these same compositions with `--scale=0.5` (1920x1080, supersampled).
const W = 3840;
const H = 2160;

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="GoldGridMorph-V1"
        component={GoldGridMorph}
        durationInFrames={GRID_FRAMES}
        fps={30}
        width={W}
        height={H}
        defaultProps={{ variant: "match" as const }}
      />
      <Composition
        id="GoldGridMorph-V2"
        component={GoldGridMorph}
        durationInFrames={GRID_FRAMES}
        fps={30}
        width={W}
        height={H}
        defaultProps={{ variant: "alt" as const }}
      />
    </>
  );
};
