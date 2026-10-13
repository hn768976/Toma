import React from "react";
import { Composition } from "remotion";
import { VERSIONS } from "./versions";

// All compositions are defined at 3840x2160, 30 fps. Pass
// --props='{"loopCheck":true}' to render one extra frame (frame `frames`),
// which must equal frame 0 for the loops.
export const RemotionRoot: React.FC = () => (
  <>
    {VERSIONS.map((v) => (
      <Composition
        key={v.id}
        id={v.id}
        component={v.component}
        durationInFrames={v.frames}
        fps={30}
        width={3840}
        height={2160}
        defaultProps={{ ...v.props, loopCheck: false }}
        calculateMetadata={({ props }) => ({
          durationInFrames: v.frames + ((props as { loopCheck?: boolean }).loopCheck ? 1 : 0),
        })}
      />
    ))}
  </>
);
