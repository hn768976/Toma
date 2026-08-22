// Every prop draws into a square, origin-centred SVG so its local (0,0) lines
// up with the SceneItem anchor. `half` is the drawing's half-extent in local
// units; `scale` maps local units to scene px.

import React from "react";

export const Svg: React.FC<{
  half: number;
  scale?: number;
  children: React.ReactNode;
}> = ({ half, scale = 1, children }) => (
  <svg
    viewBox={`${-half} ${-half} ${half * 2} ${half * 2}`}
    style={{
      position: "absolute",
      left: -half * scale,
      top: -half * scale,
      width: half * 2 * scale,
      height: half * 2 * scale,
      overflow: "visible",
    }}
  >
    {children}
  </svg>
);
