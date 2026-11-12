import React from "react";
import { Composition } from "remotion";
import { DataCube } from "./DataCube/DataCube";

/** 4K UHD masters. Deliverables are rendered from these with `--scale=0.5` (1920x1080). */
export const WIDTH = 3840;
export const HEIGHT = 2160;
export const FPS = 30;
/** Reference clip is 4.700 s -> 141 frames @ 30 fps. */
export const DURATION_IN_FRAMES = 141;

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="DataCubeAssembly-V1-Reference"
        component={DataCube}
        durationInFrames={DURATION_IN_FRAMES}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
        defaultProps={{ variant: "reference" as const }}
      />
      <Composition
        id="DataCubeAssembly-V2-LowOrbitCrane"
        component={DataCube}
        durationInFrames={DURATION_IN_FRAMES}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
        defaultProps={{ variant: "orbit" as const }}
      />
    </>
  );
};
