import React, { useMemo } from "react";
import { AbsoluteFill } from "remotion";
import { ThreeStage } from "./three/ThreeStage";
import { AMBER_PALETTE, GREEN_PALETTE } from "./market/config";
import { createMarketScene } from "./market/MarketScene";

export type MarketFlythroughProps = { version: "v1" | "v2" };

/**
 * Stock-market data fly-through: LED line charts drawing themselves,
 * ticker tables, candlesticks and a lens-flared network, travelled by a
 * single continuous camera. v1 = reference green, v2 = amber palette.
 */
export const MarketFlythrough: React.FC<MarketFlythroughProps> = ({
  version,
}) => {
  const create = useMemo(
    () => createMarketScene(version === "v1" ? GREEN_PALETTE : AMBER_PALETTE),
    [version],
  );
  return (
    <ThreeStage
      create={create}
      overlay={
        <AbsoluteFill
          style={{
            background:
              "radial-gradient(ellipse 66% 64% at 50% 50%, rgba(0,0,0,0) 34%, rgba(0,0,0,0.68) 74%, rgba(0,0,0,0.97) 100%)",
          }}
        />
      }
    />
  );
};
