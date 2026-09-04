import React from "react";
import { Composition } from "remotion";
import {
  COMP_HEIGHT,
  COMP_WIDTH,
  DURATION_IN_FRAMES,
  FPS,
} from "./data-city/constants";
import { DataCity } from "./data-city/DataCity";
import { V1, V2, V3 } from "./data-city/variants";

/**
 * Every composition is authored at 4K and loops over exactly 300 frames.
 * Render a 1080p preview with `--scale=0.5`; the same file renders at full 4K
 * with `--scale=1` and looks identical, only larger.
 */
export const RemotionRoot: React.FC = () => (
  <>
    {[V1, V2, V3].map((v) => (
      <Composition
        key={v.id}
        id={v.id}
        component={DataCity}
        durationInFrames={DURATION_IN_FRAMES}
        fps={FPS}
        width={COMP_WIDTH}
        height={COMP_HEIGHT}
        defaultProps={{ variant: v.id }}
      />
    ))}
  </>
);
