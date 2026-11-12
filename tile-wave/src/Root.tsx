import React from "react";
import { Composition } from "remotion";
import { TileWave } from "./TileWave";
import { DURATION_IN_FRAMES, FPS, HEIGHT, WIDTH } from "./variants";

// Two 4K (3840x2160) compositions, 30 fps, 267 frames each.
//  - TileWave-V1: faithful recreation of the reference (locked-off top-down view).
//  - TileWave-V2: same animation, alternative camera: low oblique tracking shot.
export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="TileWave-V1"
        component={TileWave}
        durationInFrames={DURATION_IN_FRAMES}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
        defaultProps={{ variant: "v1" as const }}
      />
      <Composition
        id="TileWave-V2"
        component={TileWave}
        durationInFrames={DURATION_IN_FRAMES}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
        defaultProps={{ variant: "v2" as const }}
      />
    </>
  );
};
