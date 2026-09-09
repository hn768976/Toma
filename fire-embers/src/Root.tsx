import React from "react";
import { Composition } from "remotion";

import { Embers } from "./embers/Embers";
import {
  DURATION,
  FPS,
  HEIGHT,
  VARIANTS,
  WIDTH,
} from "./embers/variants";

export const RemotionRoot: React.FC = () => {
  return (
    <>
      {VARIANTS.map((variant) => (
        <Composition
          key={variant.id}
          id={variant.id}
          component={Embers}
          durationInFrames={DURATION}
          fps={FPS}
          width={WIDTH}
          height={HEIGHT}
          defaultProps={{ config: variant.config, variant: variant.id }}
        />
      ))}
    </>
  );
};
