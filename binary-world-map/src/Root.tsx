import React from "react";
import {Composition} from "remotion";
import {BinaryMap} from "./BinaryMap";
import {DURATION_IN_FRAMES, FPS, HEIGHT, WIDTH} from "./config";

export const RemotionRoot: React.FC = () => {
  return (
    <Composition
      id="BinaryWorldMap"
      component={BinaryMap}
      durationInFrames={DURATION_IN_FRAMES}
      fps={FPS}
      width={WIDTH}
      height={HEIGHT}
      defaultProps={{variant: "blue" as const}}
    />
  );
};
