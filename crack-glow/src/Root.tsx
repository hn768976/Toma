import React from "react";
import { Composition } from "remotion";
import { CrackGlow, crackGlowSchema, crackGlowV1, crackGlowV2 } from "./CrackGlow";

/** 4K UHD master resolution. */
export const WIDTH = 3840;
export const HEIGHT = 2160;
export const FPS = 30;
/** Reference clip: 182 frames (6.07 s). */
export const DURATION_IN_FRAMES = 182;

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="CrackGlowV1"
        component={CrackGlow}
        durationInFrames={DURATION_IN_FRAMES}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
        schema={crackGlowSchema}
        defaultProps={crackGlowV1}
      />
      <Composition
        id="CrackGlowV2"
        component={CrackGlow}
        durationInFrames={DURATION_IN_FRAMES}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
        schema={crackGlowSchema}
        defaultProps={crackGlowV2}
      />
    </>
  );
};
