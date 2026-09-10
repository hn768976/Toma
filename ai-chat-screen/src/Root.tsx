import React from "react";
import { Composition } from "remotion";

import { AIChatScreen, aiChatScreenDefaultProps } from "./AIChatScreen";
import { DURATION_IN_FRAMES, FPS, HEIGHT, WIDTH } from "./constants";
import { ORB_AMBER, ORB_CYAN } from "./theme";

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="AIChatScreenCyan"
        component={AIChatScreen}
        durationInFrames={DURATION_IN_FRAMES}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
        defaultProps={{ ...aiChatScreenDefaultProps, palette: ORB_CYAN }}
      />
      <Composition
        id="AIChatScreenAmber"
        component={AIChatScreen}
        durationInFrames={DURATION_IN_FRAMES}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
        defaultProps={{ ...aiChatScreenDefaultProps, palette: ORB_AMBER }}
      />
    </>
  );
};
