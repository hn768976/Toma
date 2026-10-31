import React from "react";
import { Composition, Folder } from "remotion";
import { GlowingDecline } from "./glow/GlowingDecline";
import { EMBER, GLACIER } from "./glow/palettes";
import { RibbonDecline } from "./ribbon/RibbonDecline";

/** All compositions are authored at 4K UHD, 30 fps. */
const WIDTH = 3840;
const HEIGHT = 2160;
const FPS = 30;

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Folder name="Comp1-GlowingDecline">
        <Composition
          id="Comp1-V1-Ember"
          component={GlowingDecline}
          durationInFrames={450}
          fps={FPS}
          width={WIDTH}
          height={HEIGHT}
          defaultProps={{ palette: EMBER }}
        />
        <Composition
          id="Comp1-V2-Glacier"
          component={GlowingDecline}
          durationInFrames={450}
          fps={FPS}
          width={WIDTH}
          height={HEIGHT}
          defaultProps={{ palette: GLACIER }}
        />
      </Folder>
      <Folder name="Comp2-RibbonDecline">
        <Composition
          id="Comp2-V1-Static"
          component={RibbonDecline}
          durationInFrames={210}
          fps={FPS}
          width={WIDTH}
          height={HEIGHT}
          defaultProps={{ cameraMode: "static" as const }}
        />
        <Composition
          id="Comp2-V2-Orbit"
          component={RibbonDecline}
          durationInFrames={210}
          fps={FPS}
          width={WIDTH}
          height={HEIGHT}
          defaultProps={{ cameraMode: "orbit" as const }}
        />
      </Folder>
    </>
  );
};
