import React from "react";
import { arcPath, polar } from "../geometry/gear";
import { CENTRE, type RingDef } from "../layout";
import type { Theme } from "../theme";

/** Broken concentric ring around the centre word, with open node markers. */
export const Ring: React.FC<{
  def: RingDef;
  rotation: number;
  w: number;
  h: number;
  u: number;
  theme: Theme;
}> = ({ def, rotation, w, h, u, theme }) => {
  const cx = CENTRE.x * w;
  const cy = CENTRE.y * h;
  const r = def.r * u;
  const stroke = def.white ? theme.sweepStroke : theme.orbitStroke;

  return (
    <g
      transform={`rotate(${rotation} ${cx} ${cy})`}
      stroke={stroke}
      strokeOpacity={def.opacity}
      strokeWidth={def.strokeWidth * u}
      fill="none"
      strokeLinecap="round"
    >
      {def.arcs.map(([from, to], i) => (
        <path key={i} d={arcPath(cx, cy, r, from, to < from ? to + 360 : to)} />
      ))}
      {(def.nodes ?? []).map((deg, i) => {
        const [x, y] = polar(cx, cy, r, deg);
        return <circle key={i} cx={x} cy={y} r={(def.nodeR ?? 0.01) * u} />;
      })}
    </g>
  );
};
