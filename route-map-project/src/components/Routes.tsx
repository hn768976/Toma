import React from "react";
import type { PaletteSpec } from "../lib/palettes";
import type { LineStyle, RouteDef } from "../lib/types";

export interface PreparedRoute {
  def: RouteDef;
  d: string;
  color: string;
  /** One dash period in plane px; the march advances a whole number of these. */
  dashPeriod: number;
  dashArray?: string;
  width: number;
  /** Whole dash periods travelled over one loop. */
  marchPeriods: number;
}

/**
 * Dash geometry per style, in 1920-space units.
 *
 * The periods are long on purpose. A dash pattern marching along a line
 * switches every point it passes between on and off, so a short period plus a
 * brisk march reads as a blinking line rather than a moving one — the old
 * 7.6-unit dotted pattern pulsed any fixed point at about 5 Hz. Longer dashes
 * also match the reference plates, where they are far coarser than a hairline
 * dot screen.
 */
export const dashSpec = (style: LineStyle, u: number) => {
  if (style === "dashed") return { array: `${22 * u} ${16 * u}`, period: 38 * u };
  if (style === "dotted") return { array: `${0.1 * u} ${17.9 * u}`, period: 18 * u };
  return { array: undefined, period: 0 };
};

interface Props {
  routes: PreparedRoute[];
  pal: PaletteSpec;
  progress: number;
}

/**
 * The route network. Glow is a wide, low-opacity stroke under the line rather
 * than an SVG blur filter: at 4K a filter over the whole plane costs far more
 * per frame than it returns at this line weight.
 *
 * The core stroke is kept above ~3 device pixels on purpose. Thinner than that
 * it has no fully-covered interior, so as the map drifts sub-pixel the
 * antialiased coverage churns and the line beads and blinks along its length.
 */
export const Routes: React.FC<Props> = ({ routes, progress }) => (
  <g fill="none" strokeLinecap="round" strokeLinejoin="round">
    <g>
      {routes.map((r) => (
        <path
          key={`glow-${r.def.id}`}
          d={r.d}
          stroke={r.color}
          strokeOpacity={0.07}
          strokeWidth={r.width * 3.2}
        />
      ))}
    </g>
    <g>
      {routes.map((r) => (
        <path
          key={`halo-${r.def.id}`}
          d={r.d}
          stroke={r.color}
          strokeOpacity={0.13}
          strokeWidth={r.width * 1.8}
          strokeDasharray={r.dashArray}
          strokeDashoffset={-progress * r.marchPeriods * r.dashPeriod}
        />
      ))}
    </g>
    <g>
      {routes.map((r) => (
        <path
          key={r.def.id}
          d={r.d}
          stroke={r.color}
          strokeOpacity={0.85}
          strokeWidth={r.width}
          strokeDasharray={r.dashArray}
          strokeDashoffset={-progress * r.marchPeriods * r.dashPeriod}
        />
      ))}
    </g>
  </g>
);

interface DotProps {
  routes: PreparedRoute[];
  pal: PaletteSpec;
  u: number;
}

/** Small circular endpoint dots — distinct from the pushpins. */
export const EndpointDots: React.FC<DotProps> = ({ routes, u }) => (
  <g>
    {routes.flatMap((r) => {
      const ends = r.def.endDots ?? [true, false];
      const out: React.ReactNode[] = [];
      const m = /^M([-\d.]+),([-\d.]+)/.exec(r.d);
      const last = /([-\d.]+),([-\d.]+)$/.exec(r.d);
      if (ends[0] && m) {
        out.push(
          <g key={`${r.def.id}-a`}>
            <circle cx={+m[1]} cy={+m[2]} r={u * 6} fill={r.color} fillOpacity={0.18} />
            <circle cx={+m[1]} cy={+m[2]} r={u * 2.6} fill={r.color} fillOpacity={0.95} />
          </g>,
        );
      }
      if (ends[1] && last) {
        out.push(
          <g key={`${r.def.id}-b`}>
            <circle cx={+last[1]} cy={+last[2]} r={u * 6} fill={r.color} fillOpacity={0.18} />
            <circle cx={+last[1]} cy={+last[2]} r={u * 2.6} fill={r.color} fillOpacity={0.95} />
          </g>,
        );
      }
      return out;
    })}
  </g>
);
