import React, { useMemo } from "react";
import { useCurrentFrame } from "remotion";
import { BUILD_IN_FRAMES } from "../constants";
import { buildIn } from "../motion";
import { mulberry32 } from "../../particle-ring/random";
import type { ChartProps } from "./types";

// Rough continents as ellipses in (lat, lon) degrees; enough to read as a
// world map once dotted and rotating. [centerLat, centerLon, latRadius, lonRadius]
const LAND: [number, number, number, number][] = [
  [48, -100, 22, 36], // North America
  [72, -40, 8, 14], // Greenland
  [-14, -60, 26, 16], // South America
  [52, 18, 12, 22], // Europe
  [4, 20, 30, 18], // Africa
  [46, 92, 24, 52], // Asia
  [-25, 134, 11, 16], // Australia
  [64, 100, 8, 40], // Siberia top edge
];

const isLand = (lat: number, lon: number, jitter: number) =>
  LAND.some(([cLat, cLon, rLat, rLon]) => {
    const dLat = (lat - cLat) / rLat;
    let dLon = lon - cLon;
    if (dLon > 180) dLon -= 360;
    if (dLon < -180) dLon += 360;
    dLon /= rLon;
    return dLat * dLat + dLon * dLon < 0.85 + jitter * 0.35;
  });

// Dotted, slowly rotating wireframe globe (orthographic projection).
export const Globe: React.FC<ChartProps> = ({
  width,
  height,
  theme,
  delay,
  seed,
}) => {
  const frame = useCurrentFrame();
  const local = frame - delay;
  const cx = width / 2;
  const cy = height / 2;
  const r = Math.min(width, height) / 2 - 4;
  const reveal = buildIn(local, 0, BUILD_IN_FRAMES);

  // Land dots on a fixed lat/lon lattice (never depends on frame).
  const dots = useMemo(() => {
    const rand = mulberry32(seed * 131 + 5);
    const list: { lat: number; lon: number }[] = [];
    for (let lat = -80; lat <= 80; lat += 6) {
      for (let lon = -180; lon < 180; lon += 6) {
        if (isLand(lat, lon, rand())) list.push({ lat, lon });
      }
    }
    return list;
  }, [seed]);

  const spin = frame * 0.5; // degrees per frame
  const tilt = -18 * (Math.PI / 180);

  const project = (lat: number, lon: number) => {
    const la = (lat * Math.PI) / 180;
    const lo = ((lon + spin) * Math.PI) / 180;
    const x = Math.cos(la) * Math.sin(lo);
    let y = Math.sin(la);
    let z = Math.cos(la) * Math.cos(lo);
    // Tilt the axis a little so it does not look like a flat clock.
    const y2 = y * Math.cos(tilt) - z * Math.sin(tilt);
    const z2 = y * Math.sin(tilt) + z * Math.cos(tilt);
    y = y2;
    z = z2;
    return { x: cx + x * r, y: cy - y * r, z };
  };

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      <defs>
        <radialGradient id={`globe-${seed}`} cx="0.35" cy="0.3" r="0.8">
          <stop offset="0" stopColor={theme.accent} stopOpacity={0.35} />
          <stop offset="1" stopColor={theme.accent} stopOpacity={0.05} />
        </radialGradient>
      </defs>
      <circle cx={cx} cy={cy} r={r} fill={`url(#globe-${seed})`} opacity={reveal} />
      <circle
        cx={cx}
        cy={cy}
        r={r}
        fill="none"
        stroke={theme.accentAlt}
        strokeOpacity={0.7}
        strokeWidth={1.2}
        pathLength={1}
        strokeDasharray={`${reveal} 1`}
        transform={`rotate(-90 ${cx} ${cy})`}
      />
      {/* Latitude lines */}
      <g stroke={theme.accentAlt} strokeOpacity={0.22} strokeWidth={1} fill="none" opacity={reveal}>
        {[-60, -30, 0, 30, 60].map((lat) => {
          const la = (lat * Math.PI) / 180;
          const ry = r * Math.sin(la);
          const rx = r * Math.cos(la);
          return (
            <ellipse
              key={lat}
              cx={cx}
              cy={cy - ry * Math.cos(tilt)}
              rx={rx}
              ry={Math.max(0.5, Math.abs(rx * Math.sin(tilt)))}
            />
          );
        })}
      </g>
      {/* Meridians (rotating) */}
      <g stroke={theme.accentAlt} strokeOpacity={0.22} strokeWidth={1} fill="none" opacity={reveal}>
        {[0, 30, 60, 90, 120, 150].map((lon) => {
          const a = ((lon + spin) * Math.PI) / 180;
          const rx = Math.abs(Math.cos(a)) * r;
          return (
            <ellipse
              key={lon}
              cx={cx}
              cy={cy}
              rx={Math.max(0.5, rx)}
              ry={r}
              transform={`rotate(${(tilt * 180) / Math.PI} ${cx} ${cy})`}
            />
          );
        })}
      </g>
      {/* Land dots, front hemisphere only */}
      <g fill={theme.highlight} opacity={reveal}>
        {dots.map((d, i) => {
          const p = project(d.lat, d.lon);
          if (p.z <= 0.02) return null;
          return (
            <circle
              key={i}
              cx={p.x}
              cy={p.y}
              r={1.6 + p.z * 0.9}
              opacity={0.25 + p.z * 0.75}
            />
          );
        })}
      </g>
    </svg>
  );
};
