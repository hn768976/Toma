import React from "react";
import { Composition } from "remotion";
import { DataSpace } from "./dataspace/DataSpace";
import { COMP_H, COMP_W, FPS, LOOP } from "./lib/loop";
import { WATER_PALETTES, WaterPaletteKey } from "./water/palettes";
import { UnderwaterBubbles } from "./water/UnderwaterBubbles";
import { UnderwaterRays } from "./water/UnderwaterRays";

// All compositions: 3840×2160, 30 fps, 600 frames (20 s seamless loops).
// Render a preview with --scale=0.3333333333333333 (→ 1280×720).
// DURATION can be overridden (e.g. 601) for the loop check via input props.
const common = { width: COMP_W, height: COMP_H, fps: FPS } as const;

export const RemotionRoot: React.FC = () => {
  const keys = Object.keys(WATER_PALETTES) as WaterPaletteKey[];
  return (
    <>
      <Composition
        id="DataSpace-Slate"
        component={DataSpace}
        durationInFrames={LOOP}
        {...common}
        calculateMetadata={({ props }) => ({ durationInFrames: (props as { frames?: number }).frames ?? LOOP })}
        defaultProps={{}}
      />
      {keys.map((k) => (
        <Composition
          key={`b-${k}`}
          id={`UnderwaterBubbles-${k}`}
          component={UnderwaterBubbles}
          durationInFrames={LOOP}
          {...common}
          defaultProps={{ palette: k }}
          calculateMetadata={({ props }) => ({ durationInFrames: (props as { frames?: number }).frames ?? LOOP })}
        />
      ))}
      {keys.map((k) => (
        <Composition
          key={`r-${k}`}
          id={`UnderwaterRays-${k}`}
          component={UnderwaterRays}
          durationInFrames={LOOP}
          {...common}
          defaultProps={{ palette: k }}
          calculateMetadata={({ props }) => ({ durationInFrames: (props as { frames?: number }).frames ?? LOOP })}
        />
      ))}
    </>
  );
};
