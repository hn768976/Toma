import React, { useEffect, useMemo } from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { LOOKDEV_FRAMES, type Variant } from "./config";
import { GRADE, LENS } from "./look";
import { Stage } from "./three/Stage";
import { buildChipsWorld } from "./scene/chipsWorld";
import { CAMERA_PATHS } from "./scene/camera";

const Scene: React.FC<{ variant: Variant; frame: number }> = ({ variant, frame }) => {
  // The world is static and built once; only the camera depends on the frame.
  const world = useMemo(() => buildChipsWorld(), []);
  useEffect(() => () => world.dispose(), [world]);
  return <Stage world={world} camera={CAMERA_PATHS[variant]} lens={LENS} grade={GRADE} frame={frame} />;
};

export type MemoryChipsProps = { variant: Variant };

export const MemoryChips: React.FC<MemoryChipsProps> = ({ variant }) => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={{ backgroundColor: "#000" }}>
      <Scene variant={variant} frame={frame} />
    </AbsoluteFill>
  );
};

/** Look development: frames 0, 1, 2 show the three key moments as stills. */
export const LookDev: React.FC<MemoryChipsProps> = ({ variant }) => {
  const frame = useCurrentFrame();
  const moment = LOOKDEV_FRAMES[Math.min(frame, LOOKDEV_FRAMES.length - 1)];
  return (
    <AbsoluteFill style={{ backgroundColor: "#000" }}>
      <Scene variant={variant} frame={moment} />
    </AbsoluteFill>
  );
};
