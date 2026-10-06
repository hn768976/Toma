import React from "react";
import { Composition } from "remotion";
import { versions } from "./versions";

// All compositions are defined at 3840×2160, 30 fps.
export const RemotionRoot: React.FC = () => (
  <>
    {versions.map((v) => (
      <Composition
        key={v.id}
        id={v.id}
        component={v.component}
        durationInFrames={v.durationInFrames}
        fps={30}
        width={3840}
        height={2160}
        defaultProps={v.layout ? { palette: v.palette, layout: v.layout } : { palette: v.palette }}
      />
    ))}
  </>
);
