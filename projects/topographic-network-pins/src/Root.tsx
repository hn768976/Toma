import React from "react";
import { Composition } from "remotion";
import { TopoNetwork } from "./Topo/TopoNetwork";
import { DURATION_IN_FRAMES } from "./Topo/scene";

/** 4K UHD masters. Deliverables are rendered from these with `--scale=0.5` (1920x1080). */
export const WIDTH = 3840;
export const HEIGHT = 2160;
export const FPS = 30;

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="TopoNetworkPins-V1-Reference"
        component={TopoNetwork}
        durationInFrames={DURATION_IN_FRAMES}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
        defaultProps={{ palette: "reference" as const }}
      />
      <Composition
        id="TopoNetworkPins-V2-AuroraPalette"
        component={TopoNetwork}
        durationInFrames={DURATION_IN_FRAMES}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
        defaultProps={{ palette: "aurora" as const }}
      />
    </>
  );
};
