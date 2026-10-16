import { Composition } from "remotion";
import { AIHUD } from "./looks/aihud/AIHUD";
import { ParticleHeart } from "./looks/heart/ParticleHeart";
import { LoadingHUD } from "./looks/loading/LoadingHUD";
import { MarketMap } from "./looks/map/MarketMap";
import { StockScreen } from "./looks/stock/StockScreen";
import { isLoop, Version, VERSIONS } from "./versions";

export interface LookProps extends Record<string, unknown> {
  version: Version;
  /** Verification only: adds one frame so frame 600 can be compared with frame 0. */
  loopCheck: boolean;
}

const LookRouter: React.FC<LookProps> = ({ version }) => {
  switch (version.look) {
    case "aihud":
      return <AIHUD palette={version.palette} />;
    case "stock":
      return <StockScreen palette={version.palette} />;
    case "heart":
      return <ParticleHeart palette={version.palette} />;
    case "map":
      return <MarketMap palette={version.palette} />;
    case "loading":
      return <LoadingHUD palette={version.palette} />;
    default:
      return null;
  }
};

export const RemotionRoot: React.FC = () => (
  <>
    {VERSIONS.map((v) => (
      <Composition
        key={v.id}
        id={v.id}
        component={LookRouter}
        durationInFrames={v.durationInFrames}
        fps={30}
        width={3840}
        height={2160}
        defaultProps={{ version: v, loopCheck: false } satisfies LookProps}
        calculateMetadata={({ props }) => ({
          durationInFrames: v.durationInFrames + (props.loopCheck && isLoop(v) ? 1 : 0),
        })}
      />
    ))}
  </>
);
