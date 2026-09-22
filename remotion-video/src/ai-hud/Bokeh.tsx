import React from "react";
import { useCurrentFrame } from "remotion";
import { PALETTE } from "./constants";
import { BOKEH } from "./geometry";
import { wave } from "./loop";

/**
 * Drifting out-of-focus highlights.
 *
 * Each disc walks a closed Lissajous path — x and y are sines with INTEGER
 * frequencies over the loop — so the whole field returns to its frame-0
 * arrangement. The set is mostly blue with four warm discs seeded through it
 * so at least two orange ones are in frame at any time.
 *
 * These sit on their own untilted planes: tilting them would squash the
 * circles into ellipses, which is not what an out-of-focus point light does.
 *
 * The defocus is an SVG blur on each disc, not a CSS blur on the layer — see
 * the note by #bokehFront in Defs.tsx.
 */
export const BokehLayer: React.FC<{ front: boolean }> = ({ front }) => {
  const frame = useCurrentFrame();
  return (
    <g>
      {BOKEH.filter((b) => b.front === front).map((b, i) => {
        const x = b.x + wave(frame, b.fx, b.sx) * b.ax;
        const y = b.y + wave(frame, b.fy, b.sy) * b.ay;
        return (
          <circle
            key={i}
            cx={x}
            cy={y}
            r={b.r}
            fill={b.warm ? PALETTE.warm : "#63C6F2"}
            opacity={b.opacity}
            filter={front ? "url(#bokehFront)" : "url(#bokehBack)"}
          />
        );
      })}
    </g>
  );
};
