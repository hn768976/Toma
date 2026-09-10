import React from "react";
import { Composition } from "remotion";
import { DigitalDebris } from "./DigitalDebris";

/** 20 seconds at 30fps. Every motion period divides this exactly. */
const DURATION = 600;

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="V1-DigitalDebrisTeal"
        component={DigitalDebris}
        durationInFrames={DURATION}
        fps={30}
        width={3840}
        height={2160}
        defaultProps={{ variant: "teal" as const }}
      />
      <Composition
        id="V2-DigitalDebrisViolet"
        component={DigitalDebris}
        durationInFrames={DURATION}
        fps={30}
        width={3840}
        height={2160}
        defaultProps={{ variant: "violet" as const }}
      />
    </>
  );
};
