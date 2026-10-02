import React from "react";
import { Composition } from "remotion";
import { Stage, type LookFactory } from "./lib/Stage";
import { createLightTrails, TRAILS_FRAMES } from "./looks/trails/LightTrails";
import { createCloudServers, CLOUD_FRAMES } from "./looks/cloud/CloudServers";
import { createGoldBarChart, GOLD_FRAMES } from "./looks/gold/GoldBarChart";
import { createTradeWar, TRADE_FRAMES } from "./looks/trade/TradeWar";
import { createFileWave, FILES_FRAMES } from "./looks/files/FileWave";
import { CLOUD_ROWS, FILES_ROWS, GOLD_ROWS, TRADE_ROWS, TRAILS_ROWS } from "./versions";

// All compositions are defined at 3840x2160, 30 fps. Render previews with
// --scale=0.3333333333333333 (1280x720) and finals at --scale=1.
const W = 3840;
const H = 2160;
const FPS = 30;

type WithLoop<T> = T & { loopCheck?: boolean };

function register<T extends { id: string }>(rows: T[], factory: LookFactory<T>, frames: number, loops: boolean) {
  const Comp: React.FC<WithLoop<T>> = (props) => <Stage factory={factory} props={props} />;
  return rows.map((row) => (
    <Composition
      key={row.id}
      // Remotion ids may not contain "_": LightTrails_Blue -> LightTrails-Blue
      id={row.id.replace(/_/g, "-")}
      component={Comp as unknown as React.FC<Record<string, unknown>>}
      width={W}
      height={H}
      fps={FPS}
      durationInFrames={frames}
      defaultProps={{ ...row, loopCheck: false } as unknown as Record<string, unknown>}
      // loopCheck: true adds frame `frames` so frame 0 and frame N can be compared
      calculateMetadata={
        loops
          ? ({ props }) => ({ durationInFrames: (props as { loopCheck?: boolean }).loopCheck ? frames + 1 : frames })
          : undefined
      }
    />
  ));
}

export const RemotionRoot: React.FC = () => (
  <>
    {register(CLOUD_ROWS, createCloudServers, CLOUD_FRAMES, true)}
    {register(TRAILS_ROWS, createLightTrails, TRAILS_FRAMES, true)}
    {register(GOLD_ROWS, createGoldBarChart, GOLD_FRAMES, false)}
    {register(TRADE_ROWS, createTradeWar, TRADE_FRAMES, false)}
    {register(FILES_ROWS, createFileWave, FILES_FRAMES, true)}
  </>
);
