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

const multiples = (min: number, max: number, step: number) => {
  const out: number[] = [];
  for (let v = Math.ceil(min / step) * step; v <= max; v += step) out.push(Math.round(v * 1e6) / 1e6);
  return out;
};

/**
 * The latitude/longitude graticule and the numeric edge readouts — the only
 * linework on the plate that is not a route.
 *
 * Stroke widths matter more than they look here. A line narrower than about
 * two device pixels has no stable interior, so as the map drifts sub-pixel its
 * antialiased coverage churns and the line visibly shimmers. These are
 * deliberately wide and dim rather than thin and bright, which reads the same
 * but holds still. No glow either: a soft grid fogs the whole frame.
 */
export const Graticule: React.FC<Props> = ({ region, g, pal, u, frame, duration }) => {
  const w = g.window;
  const x0 = toPlane(w.lonMin, 0, g)[0];
  const x1 = toPlane(w.lonMax, 0, g)[0];
  const y0 = toPlane(0, w.latMax, g)[1];
  const y1 = toPlane(0, w.latMin, g)[1];

  const lons = multiples(w.lonMin, w.lonMax, region.gridStep);
  const lats = multiples(w.latMin, w.latMax, region.gridStep);
  const isMajor = (v: number) =>
    Math.abs(Math.round(v / region.gridStep) % region.gridMajor) === 0;

  const minor = u * 2.2;
  const major = u * 3.4;
  const minorOpacity = pal.gridOpacity * 0.62;
  const majorOpacity = pal.gridMajorOpacity * 0.72;

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

  return (
    <g>
      <g stroke={pal.grid} fill="none">
        {lons.map((lon) => {
          const x = toPlane(lon, 0, g)[0];
          const m = isMajor(lon);
          return (
            <line
              key={`lon${lon}`}
              x1={x}
              y1={y0}
              x2={x}
              y2={y1}
              strokeOpacity={m ? majorOpacity : minorOpacity}
              strokeWidth={m ? major : minor}
            />
          );
        })}
        {lats.map((lat) => {
          const y = toPlane(0, lat, g)[1];
          const m = isMajor(lat);
          return (
            <line
              key={`lat${lat}`}
              x1={x0}
              y1={y}
              x2={x1}
              y2={y}
              strokeOpacity={m ? majorOpacity : minorOpacity}
              strokeWidth={m ? major : minor}
            />
          );
        })}
      </g>
      {readouts}
    </g>
  );
};
