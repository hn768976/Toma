// Registers the nine 4K compositions.
//
// Each version is registered once, at the 3840x2160 master size. The delivered
// 1080p MP4s are produced by rendering these same compositions at --scale 0.5
// rather than by keeping a second set of half-size compositions, so there is
// only ever one definition of a version to keep in sync.

import React from "react";
import { Composition } from "remotion";
import { V01Halo } from "./versions/V01Halo";
import { V02Projection } from "./versions/V02Projection";
import { V03Fibers } from "./versions/V03Fibers";
import { V04Pedestal } from "./versions/V04Pedestal";
import { V05Flythrough } from "./versions/V05Flythrough";
import { V06Amber } from "./versions/V06Amber";
import { V07Hud } from "./versions/V07Hud";
import { V08Chevron } from "./versions/V08Chevron";
import { V09Assembly } from "./versions/V09Assembly";
import { FPS, MASTER_HEIGHT, MASTER_WIDTH, VersionId, VERSIONS } from "./versions";

const COMPONENTS: Record<VersionId, React.FC> = {
  V01Halo,
  V02Projection,
  V03Fibers,
  V04Pedestal,
  V05Flythrough,
  V06Amber,
  V07Hud,
  V08Chevron,
  V09Assembly,
};

export const AiCompositions: React.FC = () => (
  <>
    {VERSIONS.map((version) => {
      return (
        <Composition
          key={version.id}
          id={version.id}
          component={COMPONENTS[version.id]}
          durationInFrames={version.durationInFrames}
          fps={FPS}
          width={MASTER_WIDTH}
          height={MASTER_HEIGHT}
        />
      );
    })}
  </>
);
