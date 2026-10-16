import React from "react";
import { Composition } from "remotion";
import { AIHub } from "./looks/aihub/AIHub";
import { AIHUB_VERSIONS } from "./looks/aihub/versions";
import { GearWorld } from "./looks/gears/GearWorld";
import { GEAR_VERSIONS } from "./looks/gears/versions";
import { HoloPeople } from "./looks/holo/HoloPeople";
import { HOLO_VERSIONS } from "./looks/holo/versions";
import { NetworkGrowth } from "./looks/network/NetworkGrowth";
import { NETWORK_VERSIONS } from "./looks/network/versions";
import { TimelineHUD } from "./looks/timeline/TimelineHUD";
import { TIMELINE_VERSIONS } from "./looks/timeline/versions";

const W = 3840;
const H = 2160;
const FPS = 30;

// Loops are 600 frames. Rendering with --props='{"loopCheck":true}' makes them
// 601 frames so frame 600 can be compared with frame 0 (they must match).
const loopMeta = ({ props }: { props: { loopCheck?: boolean } }) => ({ durationInFrames: props.loopCheck ? 601 : 600 });

export const RemotionRoot: React.FC = () => {
  return (
    <>
      {NETWORK_VERSIONS.map((v) => (
        <Composition key={v.id} id={v.id} component={NetworkGrowth} defaultProps={{ v }} durationInFrames={600} fps={FPS} width={W} height={H} />
      ))}
      {HOLO_VERSIONS.map((v) => (
        <Composition key={v.id} id={v.id} component={HoloPeople} defaultProps={{ v, loopCheck: false }} durationInFrames={600} calculateMetadata={loopMeta} fps={FPS} width={W} height={H} />
      ))}
      {TIMELINE_VERSIONS.map((v) => (
        <Composition key={v.id} id={v.id} component={TimelineHUD} defaultProps={{ v }} durationInFrames={300} fps={FPS} width={W} height={H} />
      ))}
      {AIHUB_VERSIONS.map((v) => (
        <Composition key={v.id} id={v.id} component={AIHub} defaultProps={{ v }} durationInFrames={360} fps={FPS} width={W} height={H} />
      ))}
      {GEAR_VERSIONS.map((v) => (
        <Composition key={v.id} id={v.id} component={GearWorld} defaultProps={{ v, loopCheck: false }} durationInFrames={600} calculateMetadata={loopMeta} fps={FPS} width={W} height={H} />
      ))}
    </>
  );
};
