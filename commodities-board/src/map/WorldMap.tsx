import React, { useMemo } from "react";
import { LAND_PATHS, MAP_VIEWBOX_HEIGHT, MAP_VIEWBOX_WIDTH } from "./land";
import { rngFor } from "../random";
import { DURATION_IN_FRAMES } from "../constants";
import type { Theme } from "../theme";

type Node = { x: number; y: number; badge: boolean };

/**
 * Marker and link placement is seeded, so the map is identical on every render
 * and on every thread. Nodes are biased toward the populated latitudes.
 */
const build = () => {
  const rng = rngFor("worldmap:v1");
  const nodes: Node[] = [];
  const bands: [number, number, number][] = [
    // [lon range start, lon range width, latitude centre]
    [-130, 60, 42],
    [-95, 50, 4],
    [-12, 46, 50],
    [12, 40, 8],
    [40, 60, 34],
    [95, 55, 22],
    [112, 45, -26],
  ];
  for (const [lon0, lonW, lat0] of bands) {
    const count = 3 + Math.floor(rng() * 3);
    for (let i = 0; i < count; i++) {
      const lon = lon0 + rng() * lonW;
      const lat = lat0 + (rng() - 0.5) * 26;
      nodes.push({
        x: ((lon + 180) / 360) * MAP_VIEWBOX_WIDTH,
        y: ((90 - lat) / 180) * MAP_VIEWBOX_HEIGHT,
        badge: rng() < 0.34,
      });
    }
  }

  const links: { d: string; cycles: number; phase: number }[] = [];
  for (let i = 0; i < nodes.length; i++) {
    const linksHere = 1 + Math.floor(rng() * 2);
    for (let k = 0; k < linksHere; k++) {
      const j = Math.floor(rng() * nodes.length);
      if (j === i) continue;
      const a = nodes[i];
      const b = nodes[j];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const len = Math.hypot(dx, dy);
      if (len < 90 || len > 780) continue;
      // Bow the link away from the equator so the run of arcs reads as a
      // network laid over a globe rather than a spider web.
      const bow = Math.min(len * 0.26, 150) * (a.y + b.y > MAP_VIEWBOX_HEIGHT ? 1 : -1);
      const mx = (a.x + b.x) / 2;
      const my = (a.y + b.y) / 2 + bow;
      links.push({
        d: `M${a.x.toFixed(1)},${a.y.toFixed(1)}Q${mx.toFixed(1)},${my.toFixed(1)} ${b.x.toFixed(1)},${b.y.toFixed(1)}`,
        // Whole cycles per loop, so the pulse wraps cleanly at frame 480.
        cycles: 1 + Math.floor(rng() * 3),
        phase: rng() * Math.PI * 2,
      });
    }
  }
  return { nodes, links };
};

export const WorldMap: React.FC<{
  theme: Theme;
  frame: number;
  width: number;
  height: number;
}> = ({ theme, frame, width, height }) => {
  const { nodes, links } = useMemo(build, []);
  const t = (frame / DURATION_IN_FRAMES) * Math.PI * 2;

  return (
    <svg
      viewBox={`0 0 ${MAP_VIEWBOX_WIDTH} ${MAP_VIEWBOX_HEIGHT}`}
      width={width}
      height={height}
      preserveAspectRatio="xMidYMid slice"
      style={{ display: "block" }}
    >
      <g>
        {LAND_PATHS.map((d, i) => (
          <path
            key={i}
            d={d}
            fill={theme.mapLand}
            stroke={theme.mapLandStroke}
            strokeWidth={0.9}
            strokeLinejoin="round"
          />
        ))}
      </g>
      <g fill="none" stroke={theme.networkLine} strokeLinecap="round">
        {links.map((l, i) => (
          <path
            key={i}
            d={l.d}
            strokeWidth={1.7}
            opacity={0.28 + 0.4 * (0.5 + 0.5 * Math.sin(l.cycles * t + l.phase))}
          />
        ))}
      </g>
      <g>
        {nodes.map((n, i) => (
          <g key={i} transform={`translate(${n.x.toFixed(1)} ${n.y.toFixed(1)})`}>
            <circle r={n.badge ? 12 : 3.4} fill={theme.markerFill} />
            <circle
              r={n.badge ? 12 : 3.4}
              fill="none"
              stroke={theme.markerStroke}
              strokeWidth={n.badge ? 1.6 : 1.2}
              opacity={0.45 + 0.4 * (0.5 + 0.5 * Math.sin(2 * t + i))}
            />
            {n.badge ? (
              <>
                <circle r={3.2} fill={theme.markerStroke} opacity={0.7} />
                <path
                  d="M-6.4 0h12.8M0 -6.4v12.8"
                  stroke={theme.markerStroke}
                  strokeWidth={0.9}
                  opacity={0.3}
                />
              </>
            ) : null}
          </g>
        ))}
      </g>
    </svg>
  );
};
