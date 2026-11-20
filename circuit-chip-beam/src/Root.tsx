import React from "react";
import { Composition, useCurrentFrame } from "remotion";
import { DURATION_FRAMES, FPS, HEIGHT, PALETTE_V1, PALETTE_V2, WIDTH } from "./config";
import { ThreeStage } from "./lib/ThreeStage";
import { createChipScene } from "./scene/createScene";

const createV1 = createChipScene(PALETTE_V1);
const createV2 = createChipScene(PALETTE_V2);

const V1: React.FC = () => <ThreeStage create={createV1} />;
const V2: React.FC = () => <ThreeStage create={createV2} />;

/** Look-dev stills: frame 0 / 1 / 2 show the three key moments (start, peak, late). */
export const LOOKDEV_FRAMES = [15, 150, 405];
const LookDev: React.FC = () => {
  const frame = useCurrentFrame();
  return <ThreeStage create={createV1} frameOverride={LOOKDEV_FRAMES[Math.min(frame, 2)]} />;
};

export const RemotionRoot: React.FC = () => {
  const common = { width: WIDTH, height: HEIGHT, fps: FPS };
  return (
    <>
      <Composition id="V1-circuit-chip-beam" component={V1} durationInFrames={DURATION_FRAMES} {...common} />
      <Composition id="V2-circuit-chip-beam" component={V2} durationInFrames={DURATION_FRAMES} {...common} />
      <Composition id="LookDev" component={LookDev} durationInFrames={LOOKDEV_FRAMES.length} {...common} />
    </>
  );
};
