import { Composition, getInputProps } from "remotion";
import { BigDataHUD, HUD_DURATION } from "./looks/big-data-hud/BigDataHUD";
import { CyberFlythrough, CF_DURATION } from "./looks/cyber-flythrough/CyberFlythrough";
import { DataBurst, DB_DURATION } from "./looks/data-burst/DataBurst";
import { FibreStrands, FS_DURATION } from "./looks/fibre-strands/FibreStrands";
import { LightStreams, LS_DURATION } from "./looks/light-streams/LightStreams";
import { NetworkHub, NH_DURATION } from "./looks/network-hub/NetworkHub";
import {
  bigDataHudVersions,
  cyberFlythroughVersions,
  dataBurstVersions,
  fibreStrandsVersions,
  lightStreamsVersions,
  networkHubVersions,
} from "./versions";

// All compositions: 3840×2160, 30 fps. One composition per version row in
// versions.ts. Pass --props='{"loopCheck":true}' to make the looping
// compositions 601 frames long so frame 600 can be compared with frame 0.
const W = 3840;
const H = 2160;
const FPS = 30;
const loopCheck = Boolean((getInputProps() as { loopCheck?: boolean }).loopCheck);
const loopLen = (n: number) => (loopCheck ? n + 1 : n);

export const RemotionRoot = () => (
  <>
    {cyberFlythroughVersions.map((v) => (
      <Composition key={v.id} id={v.id} component={CyberFlythrough} defaultProps={{ version: v }} durationInFrames={loopLen(CF_DURATION)} fps={FPS} width={W} height={H} />
    ))}
    {networkHubVersions.map((v) => (
      <Composition key={v.id} id={v.id} component={NetworkHub} defaultProps={{ version: v }} durationInFrames={NH_DURATION} fps={FPS} width={W} height={H} />
    ))}
    {lightStreamsVersions.map((v) => (
      <Composition key={v.id} id={v.id} component={LightStreams} defaultProps={{ version: v }} durationInFrames={loopLen(LS_DURATION)} fps={FPS} width={W} height={H} />
    ))}
    {dataBurstVersions.map((v) => (
      <Composition key={v.id} id={v.id} component={DataBurst} defaultProps={{ version: v }} durationInFrames={DB_DURATION} fps={FPS} width={W} height={H} />
    ))}
    {fibreStrandsVersions.map((v) => (
      <Composition key={v.id} id={v.id} component={FibreStrands} defaultProps={{ version: v }} durationInFrames={loopLen(FS_DURATION)} fps={FPS} width={W} height={H} />
    ))}
    {bigDataHudVersions.map((v) => (
      <Composition key={v.id} id={v.id} component={BigDataHUD} defaultProps={{ version: v }} durationInFrames={loopLen(HUD_DURATION)} fps={FPS} width={W} height={H} />
    ))}
  </>
);
