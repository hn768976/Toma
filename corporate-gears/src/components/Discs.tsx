import React from "react";
import { arcPath, polar } from "../geometry/gear";
import { CENTRE, type DiscDef } from "../layout";
import type { Theme } from "../theme";
import { SoftShadow } from "./defs";

/**
 * Solid dark disc riding on one of the orbit rings, with a soft shadow to the
 * lower right and a faint highlight along its top edge.
 */
export const Disc: React.FC<{
  def: DiscDef;
  index: number;
  angle: number;
  w: number;
  h: number;
  u: number;
  theme: Theme;
}> = ({ def, index, angle, w, h, u, theme }) => {
  const r = def.r * u;
  const [x, y] = polar(CENTRE.x * w, CENTRE.y * h, def.orbit * u, angle);

  return (
    <>
      <defs>
        <SoftShadow
          id={`discShadow-${index}`}
          dx={r * 0.3}
          dy={r * 0.36}
          blur={r * 0.22}
          color={theme.shadow}
          opacity={0.42}
        />
        <radialGradient id={`discFill-${index}`} cx="0.36" cy="0.26" r="0.85">
          <stop offset="0%" stopColor={theme.discTop} />
          <stop offset="100%" stopColor={theme.discBottom} />
        </radialGradient>
      </defs>
      <g transform={`translate(${x} ${y})`}>
        <circle
          r={r * 1.075}
          fill="none"
          stroke={theme.discRing}
          strokeOpacity={theme.discRingOpacity}
          strokeWidth={r * 0.05}
          filter={`url(#discShadow-${index})`}
        />
        <circle r={r} fill={`url(#discFill-${index})`} filter={`url(#discShadow-${index})`} />
        <path
          d={arcPath(0, 0, r * 0.955, 200, 340)}
          fill="none"
          stroke="#ffffff"
          strokeOpacity={0.16}
          strokeWidth={r * 0.035}
          strokeLinecap="round"
        />
      </g>
    </>
  );
};
