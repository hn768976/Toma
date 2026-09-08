import React from "react";
import { Composition } from "remotion";
import { MagmaField } from "./MagmaField";
import { PALETTES } from "./palettes";
import { DURATION_IN_FRAMES, FPS, HEIGHT, WIDTH } from "./constants";

export const RemotionRoot: React.FC = () => {
  return (
    <>
      {PALETTES.map((palette) => (
        <Composition
          key={palette.id}
          id={palette.id}
          component={MagmaField}
          durationInFrames={DURATION_IN_FRAMES}
          fps={FPS}
          width={WIDTH}
          height={HEIGHT}
          defaultProps={{ palette }}
        />
      ))}
    </>
  );
};
