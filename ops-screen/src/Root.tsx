import React from "react";
import { Composition } from "remotion";
import { OpsScreen } from "./OpsScreen";

/**
 * Both compositions are defined at 3840 x 2160 so they can be rendered
 * at 4K later. Render a 1080p preview with --scale=0.5.
 */
export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="V1-OpsScreenGreen"
        component={OpsScreen}
        durationInFrames={600}
        fps={30}
        width={3840}
        height={2160}
        defaultProps={{ variant: "green" as const }}
      />
      <Composition
        id="V2-OpsScreenBlue"
        component={OpsScreen}
        durationInFrames={600}
        fps={30}
        width={3840}
        height={2160}
        defaultProps={{ variant: "blue" as const }}
      />
    </>
  );
};
