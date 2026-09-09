import React from "react";
import type { MapGeometry } from "../lib/geo";
import { toPlane } from "../lib/geo";
import type { PaletteSpec } from "../lib/palettes";
import type { RegionDef } from "../lib/types";

interface Props {
  region: RegionDef;
  g: MapGeometry;
  pal: PaletteSpec;
  u: number;
  frame: number;
  duration: number;
}

/**
 * The numeric edge readouts. Nothing else: the routes are the only linework on
 * the plate, so there is no graticule and no survey decor to compete with them.
 */
export const EdgeReadouts: React.FC<Props> = ({ region, g, pal, u, frame, duration }) => {
  // Numeric readouts, hung just inside the edges the camera can see. The values
  // tick on a cycle that closes at frame 480 so the loop stays seamless.
  const vis = g.visible;
  const vx0 = toPlane(vis.lonMin, 0, g)[0];
  const vx1 = toPlane(vis.lonMax, 0, g)[0];
  const vy0 = toPlane(0, vis.latMax, g)[1];
  const vy1 = toPlane(0, vis.latMin, g)[1];
  const rows = 12;
  const top = vy0 + (vy1 - vy0) * 0.16;
  const step = ((vy1 - vy0) * 0.68) / (rows + 1);
  const fontSize = u * 23;
  const tickPhase = Math.floor((frame / duration) * 4);

  const readouts = ([
    ["left", vx0 + (vx1 - vx0) * 0.075, region.edgeScale[0]],
    ["right", vx0 + (vx1 - vx0) * 0.925, region.edgeScale[1]],
  ] as const).map(([side, x, base]) => (
    <g
      key={side}
      fill={pal.readout}
      fillOpacity={0.4}
      fontSize={fontSize}
      fontFamily="RouteMapMono, monospace"
    >
      {Array.from({ length: rows }, (_, i) => {
        const y = top + step * (i + 1);
        const value = (base + i * 3 + ((tickPhase + i) % 3)) % 100;
        return (
          <text key={i} x={x} y={y} textAnchor={side === "left" ? "start" : "end"}>
            {String(value).padStart(2, "0")}
          </text>
        );
      })}
    </g>
  ));

  return <g>{readouts}</g>;
};
