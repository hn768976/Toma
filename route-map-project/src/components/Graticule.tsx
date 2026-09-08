import React from "react";
import type { MapGeometry } from "../lib/geo";
import { toPlane } from "../lib/geo";
import type { PaletteSpec } from "../lib/palettes";
import { makeRng, rngInt, rngRange } from "../lib/prng";
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
 * Latitude/longitude graticule, tick ladders, scattered survey decor and the
 * numeric edge readouts. Deliberately unglowed — a soft grid fogs the frame.
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

  const minor = u * 0.9;
  const major = u * 1.5;

  // tick ladders sit on the two graticule lines nearest the region centre
  const tickLon = lons.reduce((a, b) =>
    Math.abs(b - region.center[0]) < Math.abs(a - region.center[0]) ? b : a,
  );
  const tickLat = lats.reduce((a, b) =>
    Math.abs(b - region.center[1]) < Math.abs(a - region.center[1]) ? b : a,
  );
  const sub = region.gridStep / 5;
  const tickLen = u * 7;

  // ---- scattered decor, seeded from the region id so it never moves
  const rng = makeRng(`${region.id}:decor`);
  const decor: React.ReactNode[] = [];
  region.waterBoxes.forEach((box, bi) => {
    const n = rngInt(rng, 1, 2);
    for (let i = 0; i < n; i++) {
      const lon = rngRange(rng, box[0], box[2]);
      const lat = rngRange(rng, box[1], box[3]);
      const [px, py] = toPlane(lon, lat, g);
      const kind = rngInt(rng, 0, 2);
      const s = rngRange(rng, 26, 54) * u;
      const key = `d${bi}-${i}`;
      if (kind === 0) {
        // corner brackets
        const a = s * 0.34;
        decor.push(
          <path
            key={key}
            d={`M${px - s},${py - s + a} L${px - s},${py - s} L${px - s + a},${py - s}
                M${px + s - a},${py - s} L${px + s},${py - s} L${px + s},${py - s + a}
                M${px + s},${py + s - a} L${px + s},${py + s} L${px + s - a},${py + s}
                M${px - s + a},${py + s} L${px - s},${py + s} L${px - s},${py + s - a}`}
            fill="none"
            stroke={pal.grid}
            strokeOpacity={0.3}
            strokeWidth={minor}
          />,
        );
      } else if (kind === 1) {
        decor.push(
          <rect
            key={key}
            x={px - s}
            y={py - s * 0.62}
            width={s * 2}
            height={s * 1.24}
            fill="none"
            stroke={pal.grid}
            strokeOpacity={0.24}
            strokeWidth={minor}
          />,
        );
      } else {
        decor.push(
          <g key={key} stroke={pal.grid} strokeOpacity={0.26} strokeWidth={minor} fill="none">
            <path d={`M${px - s},${py} L${px + s},${py} M${px},${py - s} L${px},${py + s}`} />
            <circle cx={px} cy={py} r={s * 0.42} />
          </g>,
        );
      }
    }
  });

  // one wireframe globe graphic, as in the reference plates
  const gb = region.waterBoxes[0];
  const [gx, gy] = toPlane((gb[0] + gb[2]) / 2, (gb[1] + gb[3]) / 2, g);
  const gr = Math.min(u * 150, Math.abs(x1 - x0) * 0.06);
  const globe = (
    <g stroke={pal.grid} strokeOpacity={0.22} strokeWidth={minor} fill="none">
      <circle cx={gx} cy={gy} r={gr} />
      {[0.32, 0.66].map((k) => (
        <React.Fragment key={k}>
          <ellipse cx={gx} cy={gy} rx={gr * k} ry={gr} />
          <line x1={gx - gr} y1={gy - gr * k} x2={gx + gr} y2={gy - gr * k} />
          <line x1={gx - gr} y1={gy + gr * k} x2={gx + gr} y2={gy + gr * k} />
        </React.Fragment>
      ))}
      <line x1={gx} y1={gy - gr} x2={gx} y2={gy + gr} />
      <line x1={gx - gr} y1={gy} x2={gx + gr} y2={gy} />
    </g>
  );

  // ---- numeric edge readouts, hung just inside the edges the camera can see
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
    <g key={side} fill={pal.readout} fillOpacity={0.44} fontSize={fontSize} fontFamily="RouteMapMono, monospace">
      {Array.from({ length: rows }, (_, i) => {
        const y = top + step * (i + 1);
        const value = (base + i * 3 + ((tickPhase + i) % 3)) % 100;
        return (
          <React.Fragment key={i}>
            <text x={x} y={y} textAnchor={side === "left" ? "start" : "end"}>
              {String(value).padStart(2, "0")}
            </text>
            <line
              x1={side === "left" ? x - u * 16 : x + u * 6}
              y1={y - fontSize * 0.32}
              x2={side === "left" ? x - u * 6 : x + u * 16}
              y2={y - fontSize * 0.32}
              stroke={pal.readout}
              strokeOpacity={0.34}
              strokeWidth={minor}
            />
          </React.Fragment>
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
              strokeOpacity={m ? pal.gridMajorOpacity : pal.gridOpacity}
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
              strokeOpacity={m ? pal.gridMajorOpacity : pal.gridOpacity}
              strokeWidth={m ? major : minor}
            />
          );
        })}
      </g>

      <g stroke={pal.grid} strokeOpacity={0.34} strokeWidth={minor} fill="none">
        {multiples(w.latMin, w.latMax, sub).map((lat) => {
          const [x, y] = toPlane(tickLon, lat, g);
          const long = Math.abs(lat % region.gridStep) < 1e-6;
          return (
            <line key={`tk${lat}`} x1={x} y1={y} x2={x + (long ? tickLen * 1.9 : tickLen)} y2={y} />
          );
        })}
        {multiples(w.lonMin, w.lonMax, sub).map((lon) => {
          const [x, y] = toPlane(lon, tickLat, g);
          const long = Math.abs(lon % region.gridStep) < 1e-6;
          return (
            <line key={`tkl${lon}`} x1={x} y1={y} x2={x} y2={y - (long ? tickLen * 1.9 : tickLen)} />
          );
        })}
      </g>

      {globe}
      {decor}
      {readouts}
    </g>
  );
};
