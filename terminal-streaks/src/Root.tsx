import React from "react";
import { Composition } from "remotion";
import { TerminalStreaks } from "./TerminalStreaks";
import "./load-fonts";

/** 20 seconds at 30fps, mastered at 4K. Both compositions loop seamlessly. */
const WIDTH = 3840;
const HEIGHT = 2160;
const FPS = 30;
const DURATION = 600;

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="V1-TerminalStreaksColour"
        component={TerminalStreaks}
        durationInFrames={DURATION}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
        defaultProps={{ variant: "colour" as const }}
      />
      <Composition
        id="V2-TerminalStreaksAmber"
        component={TerminalStreaks}
        durationInFrames={DURATION}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
        defaultProps={{ variant: "amber" as const }}
      />
    </>
  );
};
