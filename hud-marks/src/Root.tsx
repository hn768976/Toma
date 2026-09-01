import React from "react";
import { Composition } from "remotion";
import { HudMarks } from "./hud/HudMarks";

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="HudMarksSparse"
        component={HudMarks}
        durationInFrames={300}
        fps={30}
        width={3840}
        height={2160}
        defaultProps={{ variant: "sparse" as const }}
      />
      <Composition
        id="HudMarksDense"
        component={HudMarks}
        durationInFrames={300}
        fps={30}
        width={3840}
        height={2160}
        defaultProps={{ variant: "dense" as const }}
      />
    </>
  );
};
