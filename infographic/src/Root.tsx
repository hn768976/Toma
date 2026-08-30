import React from "react";
import { Composition } from "remotion";
import { InfographicSheet } from "./InfographicSheet";
import { CANVAS_H, CANVAS_W, DURATION, FPS } from "./plane";

export const RemotionRoot: React.FC = () => {
  return (
    <>
      {/* #region comp:blue */}
      <Composition
        id="InfographicBlue"
        component={InfographicSheet}
        durationInFrames={DURATION}
        fps={FPS}
        width={CANVAS_W}
        height={CANVAS_H}
        defaultProps={{ variant: "blue" }}
      />
      {/* #endregion */}
      {/* #region comp:warm */}
      <Composition
        id="InfographicWarm"
        component={InfographicSheet}
        durationInFrames={DURATION}
        fps={FPS}
        width={CANVAS_W}
        height={CANVAS_H}
        defaultProps={{ variant: "warm" }}
      />
      {/* #endregion */}
      {/* #region comp:dark */}
      <Composition
        id="InfographicDark"
        component={InfographicSheet}
        durationInFrames={DURATION}
        fps={FPS}
        width={CANVAS_W}
        height={CANVAS_H}
        defaultProps={{ variant: "dark" }}
      />
      {/* #endregion */}
    </>
  );
};
