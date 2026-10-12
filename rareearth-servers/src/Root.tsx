import React from "react";
import { Composition, Folder } from "remotion";
import { AI_RACKS, CHIP_ON_ORE, ELEMENT_RING, EV_BATTERY, SERVER_STREAMS } from "./data/versions";
import { AIRacks } from "./looks/AIRacks";
import { ChipOnOre } from "./looks/ChipOnOre";
import { ElementRing } from "./looks/ElementRing";
import { EVBatteryPack } from "./looks/EVBatteryPack";
import { ModelCheck } from "./looks/ModelCheck";
import { ServerStreams } from "./looks/ServerStreams";

const W = 3840;
const H = 2160;
const FPS = 30;
const LOOP = 600; // 20 s seamless loops
const STORY = 300; // 10 s story

// Set LOOP_CHECK=1 when bundling to make the loops 601 frames long, so frame
// 600 can be rendered and compared with frame 0 (verify step 2).
const loopFrames = process.env.REMOTION_LOOP_CHECK === "1" ? LOOP + 1 : LOOP;

export const RemotionRoot: React.FC = () => (
  <>
    <Folder name="ElementRing">
      {ELEMENT_RING.map((row) => (
        <Composition key={row.id} id={row.id} component={ElementRing} defaultProps={{ row }}
          durationInFrames={loopFrames} fps={FPS} width={W} height={H} />
      ))}
    </Folder>
    <Folder name="ChipOnOre">
      {CHIP_ON_ORE.map((row) => (
        <Composition key={row.id} id={row.id} component={ChipOnOre} defaultProps={{ row }}
          durationInFrames={loopFrames} fps={FPS} width={W} height={H} />
      ))}
    </Folder>
    <Folder name="EVBatteryPack">
      {EV_BATTERY.map((row) => (
        <Composition key={row.id} id={row.id} component={EVBatteryPack} defaultProps={{ row }}
          durationInFrames={STORY} fps={FPS} width={W} height={H} />
      ))}
    </Folder>
    <Folder name="ServerStreams">
      {SERVER_STREAMS.map((row) => (
        <Composition key={row.id} id={row.id} component={ServerStreams} defaultProps={{ row }}
          durationInFrames={loopFrames} fps={FPS} width={W} height={H} />
      ))}
    </Folder>
    <Folder name="AIRacks">
      {AI_RACKS.map((row) => (
        <Composition key={row.id} id={row.id} component={AIRacks} defaultProps={{ row }}
          durationInFrames={loopFrames} fps={FPS} width={W} height={H} />
      ))}
    </Folder>
    <Folder name="ModelCheck">
      {(["nugget", "chip", "battery", "rack"] as const).map((o) => (
        <Composition key={o} id={`Check-${o}`} component={ModelCheck} defaultProps={{ object: o }}
          durationInFrames={1} fps={FPS} width={1920} height={1080} />
      ))}
    </Folder>
  </>
);
