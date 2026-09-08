import React from "react";
import {Composition} from "remotion";
import {WaveMap} from "./WaveMap";

/**
 * One composition, one frame. This project produces STILL IMAGES for stock
 * illustration — there is no animation, no loop and no timing.
 */
export const RemotionRoot: React.FC = () => {
  return (
    <Composition
      id="WaveMap"
      component={WaveMap}
      durationInFrames={1}
      fps={30}
      width={3840}
      height={2160}
      defaultProps={{seed: "a01", palette: "blue" as const, composition: "c01"}}
    />
  );
};
