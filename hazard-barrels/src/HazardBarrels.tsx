import React, { useEffect, useMemo } from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { LOOKDEV_FRAMES, PALETTES, type Variant } from "./config";
import { GRADE, LENS } from "./look";
import { AssetGate } from "./lib/AssetGate";
import { Stage } from "./three/Stage";
import { buildBarrelWorld } from "./scene/barrelWorld";
import { cameraAt } from "./scene/camera";
import { loadFonts } from "./scene/fonts";

const Scene: React.FC<{ variant: Variant; frame: number }> = ({ variant, frame }) => {
  // The world is static and built once; only the camera depends on the frame.
  const world = useMemo(() => buildBarrelWorld(PALETTES[variant]), [variant]);
  useEffect(() => () => world.dispose(), [world]);
  return <Stage world={world} camera={cameraAt} lens={LENS} grade={GRADE} frame={frame} />;
};

export type HazardBarrelsProps = { variant: Variant };

export const HazardBarrels: React.FC<HazardBarrelsProps> = ({ variant }) => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={{ backgroundColor: "#000" }}>
      <AssetGate promise={loadFonts()} label="Loading marking font">
        <Scene variant={variant} frame={frame} />
      </AssetGate>
    </AbsoluteFill>
  );
};

/** Look development: frames 0, 1, 2 show the three key moments as stills. */
export const LookDev: React.FC<HazardBarrelsProps> = ({ variant }) => {
  const frame = useCurrentFrame();
  const moment = LOOKDEV_FRAMES[Math.min(frame, LOOKDEV_FRAMES.length - 1)];
  return (
    <AbsoluteFill style={{ backgroundColor: "#000" }}>
      <AssetGate promise={loadFonts()} label="Loading marking font">
        <Scene variant={variant} frame={moment} />
      </AssetGate>
    </AbsoluteFill>
  );
};
