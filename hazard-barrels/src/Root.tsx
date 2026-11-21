import React from "react";
import { Composition } from "remotion";
import { LOOKDEV_FRAMES, VIDEO } from "./config";
import { HazardBarrels, LookDev } from "./HazardBarrels";

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="V1-hazard-barrels"
        component={HazardBarrels}
        defaultProps={{ variant: "v1" as const }}
        durationInFrames={VIDEO.durationInFrames}
        fps={VIDEO.fps}
        width={VIDEO.width}
        height={VIDEO.height}
      />
      <Composition
        id="V2-hazard-barrels"
        component={HazardBarrels}
        defaultProps={{ variant: "v2" as const }}
        durationInFrames={VIDEO.durationInFrames}
        fps={VIDEO.fps}
        width={VIDEO.width}
        height={VIDEO.height}
      />
      <Composition
        id="LookDev"
        component={LookDev}
        defaultProps={{ variant: "v1" as const }}
        durationInFrames={LOOKDEV_FRAMES.length}
        fps={VIDEO.fps}
        width={VIDEO.width}
        height={VIDEO.height}
      />
    </>
  );
};
