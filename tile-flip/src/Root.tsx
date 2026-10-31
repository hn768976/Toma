import React from "react";
import { Composition } from "remotion";
import { DURATION_FRAMES } from "./tiles/choreography";
import { TileFlip } from "./tiles/TileFlip";

// Both compositions are authored at 4K UHD (3840x2160) @ 30 fps.
// Reference clip: 7.8078 s (234 frames @ 29.97) -> 234 frames @ 30 fps.
const FPS = 30;
const WIDTH = 3840;
const HEIGHT = 2160;

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="TileFlip-V1"
        component={TileFlip}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
        durationInFrames={DURATION_FRAMES}
        defaultProps={{ camera: "front" as const }}
      />
      <Composition
        id="TileFlip-V2"
        component={TileFlip}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
        durationInFrames={DURATION_FRAMES}
        defaultProps={{ camera: "orbit" as const }}
      />
    </>
  );
};
