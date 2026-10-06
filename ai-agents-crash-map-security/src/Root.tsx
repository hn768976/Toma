import React from "react";
import { Composition } from "remotion";
import { LOOPING, VERSIONS, VersionRow } from "./versions";
import { AIAgentsBoard } from "./looks/board/AIAgentsBoard";
import { MarketMove } from "./looks/market/MarketMove";
import { MapDashboard } from "./looks/map/MapDashboard";
import { AINetworkPanel } from "./looks/network/AINetworkPanel";
import { SecurityHUD } from "./looks/security/SecurityHUD";

// Composition ids may not contain "_": MarketMove_CrashRed → MarketMove-CrashRed.
export const compositionId = (row: VersionRow) => row.id.replace(/_/g, "-");

export const FPS = 30;
export const DURATION = 600;

type Props = { row: VersionRow; loopCheck: boolean };

const LookSwitch: React.FC<Props> = ({ row }) => {
  switch (row.look) {
    case "board":
      return <AIAgentsBoard row={row} />;
    case "market":
      return <MarketMove row={row} />;
    case "map":
      return <MapDashboard row={row} />;
    case "network":
      return <AINetworkPanel row={row} />;
    case "security":
      return <SecurityHUD row={row} />;
  }
};

export const RemotionRoot: React.FC = () => (
  <>
    {VERSIONS.map((row) => (
      <Composition
        key={row.id}
        id={compositionId(row)}
        component={LookSwitch}
        width={3840}
        height={2160}
        fps={FPS}
        durationInFrames={DURATION}
        defaultProps={{ row, loopCheck: false } as Props}
        // `--props='{"loopCheck":true}'` makes loop compositions 601 frames,
        // so frame 600 can be compared with frame 0.
        calculateMetadata={({ props }) => ({
          durationInFrames: props.loopCheck && LOOPING.includes(props.row.look) ? DURATION + 1 : DURATION,
        })}
      />
    ))}
  </>
);
