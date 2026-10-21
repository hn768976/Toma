import React from "react";
import { Composition, getInputProps } from "remotion";
import { RobotWalk } from "./robot/RobotWalk";
import { SteampunkFrame } from "./steampunk/SteampunkFrame";
import { MachineBlueprint } from "./blueprint/MachineBlueprint";
import { OceanDepth } from "./ocean/OceanDepth";

const W = 3840;
const H = 2160;
const FPS = 30;
// `--props='{"loopCheck":true}'` makes every loop one frame longer, so the
// extra frame can be compared with frame 0.
const X = getInputProps().loopCheck ? 1 : 0;

export const RemotionRoot: React.FC = () => (
  <>
    <Composition id="SteampunkFrame-White" component={SteampunkFrame} durationInFrames={300 + X} fps={FPS} width={W} height={H} defaultProps={{ background: "white" as const }} />
    <Composition id="SteampunkFrame-Green" component={SteampunkFrame} durationInFrames={300 + X} fps={FPS} width={W} height={H} defaultProps={{ background: "green" as const }} />
    <Composition id="RobotWalk-Turnaround" component={RobotWalk} durationInFrames={360 + X} fps={FPS} width={W} height={H} defaultProps={{ background: "white" as const, turnaround: true }} />
    <Composition id="RobotWalk-Loop" component={RobotWalk} durationInFrames={300 + X} fps={FPS} width={W} height={H} defaultProps={{ background: "white" as const, turnaround: false }} />
    <Composition id="RobotWalk-Green" component={RobotWalk} durationInFrames={300 + X} fps={FPS} width={W} height={H} defaultProps={{ background: "green" as const, turnaround: false }} />
    <Composition id="MachineBlueprint-Beam" component={MachineBlueprint} durationInFrames={600 + X} fps={FPS} width={W} height={H} />
    <Composition id="OceanDepth-Labelled" component={OceanDepth} durationInFrames={450} fps={FPS} width={W} height={H} defaultProps={{ labels: true }} />
    <Composition id="OceanDepth-Clean" component={OceanDepth} durationInFrames={450} fps={FPS} width={W} height={H} defaultProps={{ labels: false }} />
  </>
);
