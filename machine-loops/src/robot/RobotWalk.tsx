import React, { useLayoutEffect, useMemo } from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { ThreeStage } from "../lib/ThreeStage";
import { linearKey } from "../lib/pipeline";
import { TAU } from "../lib/random";
import { buildRobot } from "./robot";
import { outlineUniforms } from "./toon";
import { poseRobot } from "./walk";

export type RobotWalkProps = {
  background: "white" | "green";
  turnaround: boolean; // full 360 over the composition, else fixed 3/4 view
};

const BG = { white: linearKey(1, 1, 1), green: linearKey(0, 1, 0) };
const TARGET: [number, number, number] = [0, 1.38, 0];
// Outline width as a fraction of frame height (constant on screen).
const OUTLINE_FRAC = 4.2 / 1080;

export const RobotWalk: React.FC<RobotWalkProps> = ({ background, turnaround }) => {
  const frame = useCurrentFrame();
  const rig = useMemo(() => buildRobot(), []);
  useLayoutEffect(() => {
    poseRobot(rig, frame);
    rig.root.rotation.y = turnaround ? -0.44 - (TAU * (frame % 360)) / 360 : -0.44;
  }, [frame, rig, turnaround]);
  const onSize = useMemo(
    () => (w: number, h: number) => {
      outlineUniforms.resolution.value.set(w, h);
      outlineUniforms.widthPx.value = OUTLINE_FRAC * h;
    },
    [],
  );
  return (
    <AbsoluteFill>
      <ThreeStage background={BG[background]} fov={24} position={[0, 2.4, 9.3]} target={TARGET} onSize={onSize}>
        <primitive object={rig.root} />
      </ThreeStage>
    </AbsoluteFill>
  );
};
