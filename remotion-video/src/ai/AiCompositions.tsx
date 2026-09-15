// Registers the nine 4K compositions.
//
// Each version is registered once, at the 3840x2160 master size. The delivered
// 1080p MP4s are produced by rendering these same compositions at --scale 0.5
// rather than by keeping a second set of half-size compositions, so there is
// only ever one definition of a version to keep in sync.

import React from "react";
import { Composition } from "remotion";
import { V01Halo } from "./versions/V01Halo";
import { FPS, MASTER_HEIGHT, MASTER_WIDTH, VersionId, VERSIONS } from "./versions";

const COMPONENTS: Partial<Record<VersionId, React.FC>> = {
  V01Halo,
};

export const AiCompositions: React.FC = () => (
  <>
    {VERSIONS.map((version) => {
      const component = COMPONENTS[version.id];
      if (!component) return null;
      return (
        <Composition
          key={version.id}
          id={version.id}
          component={component}
          durationInFrames={version.durationInFrames}
          fps={FPS}
          width={MASTER_WIDTH}
          height={MASTER_HEIGHT}
        />
      );
    })}
  </>
);
