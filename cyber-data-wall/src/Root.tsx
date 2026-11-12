import React from "react";
import { Composition } from "remotion";
import { CyberDataWall } from "./datawall/CyberDataWall";

// Reference clip: 19.000 s @ 30 fps = 570 frames.
export const FPS = 30;
export const DURATION_IN_FRAMES = 570;
export const WIDTH = 3840; // 4K UHD composition
export const HEIGHT = 2160;

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="CyberDataWall-V1-SteelBlue-4K"
        component={CyberDataWall}
        durationInFrames={DURATION_IN_FRAMES}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
        defaultProps={{ variant: "v1" as const }}
      />
      <Composition
        id="CyberDataWall-V2-AmberCore-4K"
        component={CyberDataWall}
        durationInFrames={DURATION_IN_FRAMES}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
        defaultProps={{ variant: "v2" as const }}
      />
    </>
  );
};
