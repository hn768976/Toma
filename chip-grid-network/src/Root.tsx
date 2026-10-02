import React from "react";
import { Composition } from "remotion";
import { ChipGridComposition } from "./ChipGridComposition";
import { ALL_COMPS, DURATION, FPS } from "./compositions/defs";

export const RemotionRoot: React.FC = () => (
  <>
    {ALL_COMPS.map((def) => (
      <Composition
        key={def.id}
        id={def.id}
        component={ChipGridComposition}
        durationInFrames={DURATION}
        fps={FPS}
        width={3840}
        height={2160}
        defaultProps={{ compId: def.id }}
      />
    ))}
  </>
);
