import React from "react";
import { Composition } from "remotion";
import { ContourMaze } from "./ContourMaze";
import { DURATION_IN_FRAMES, FPS, HEIGHT, WIDTH } from "./variants";

// Two 4K (3840x2160) compositions, 30 fps, 400 frames each.
//  - ContourMaze-V1: faithful recreation of the reference look.
//  - ContourMaze-V2: same scene and camera, alternative colour palette.
export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="ContourMaze-V1"
        component={ContourMaze}
        durationInFrames={DURATION_IN_FRAMES}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
        defaultProps={{ variant: "v1" as const }}
      />
      <Composition
        id="ContourMaze-V2"
        component={ContourMaze}
        durationInFrames={DURATION_IN_FRAMES}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
        defaultProps={{ variant: "v2" as const }}
      />
    </>
  );
};
