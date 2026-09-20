/**
 * Composition registry.
 *
 * Every composition is generated from the look list - there is no per-clip
 * code here on purpose. Adding a palette to a look, or adding a whole look,
 * registers its compositions automatically.
 */

import React from "react";
import { Composition } from "remotion";
import {
  ALL_COMPOSITIONS,
  DURATION_IN_FRAMES,
  FPS,
  HEIGHT,
  WIDTH,
} from "./looks/data";
import { PodiumStage } from "./PodiumStage";

export const RemotionRoot: React.FC = () => (
  <>
    {ALL_COMPOSITIONS.map(({ id, look, palette }) => (
      <Composition
        key={id}
        id={id}
        component={PodiumStage}
        durationInFrames={DURATION_IN_FRAMES}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
        defaultProps={{ look, palette }}
      />
    ))}
  </>
);
