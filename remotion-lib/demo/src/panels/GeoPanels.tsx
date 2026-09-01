import React from "react";
import { AbsoluteFill } from "remotion";
import { Panel } from "../Panel";
import { THEME } from "../theme";
import {
  dotMapFromLand,
  equirectangular,
  mercator,
  type LandGeoJson,
} from "../../../src/geo";

/**
 * SYNTHETIC land, not Natural Earth.
 *
 * The library deliberately does no I/O and ships no map data, so the demo
 * supplies its own GeoJSON. These are invented landmasses in lon/lat —
 * enough to prove the sampler, the projections and the coastal flag all
 * work, without pretending to be a real basemap.
 */
const SYNTHETIC_LAND: LandGeoJson = {
  type: "MultiPolygon",
  coordinates: [
    // A broad northern continent with a bay cut into its south coast.
    [
      [
        [-130, 60], [-95, 68], [-60, 62], [-52, 45], [-70, 30],
        [-84, 24], [-96, 30], [-104, 26], [-118, 34], [-130, 48], [-130, 60],
      ],
      [
        [-96, 44], [-84, 46], [-80, 38], [-90, 36], [-96, 44],
      ],
    ],
    // A long southern landmass.
    [
      [
        [-70, 8], [-52, 4], [-38, -12], [-44, -34], [-58, -50],
        [-72, -40], [-78, -18], [-70, 8],
      ],
    ],
    // A large eastern mass.
    [
      [
        [10, 56], [60, 68], [110, 62], [135, 44], [120, 22],
        [95, 10], [70, 20], [40, 14], [16, 32], [10, 56],
      ],
    ],
    // An island, to show the coastal flag on a small shape.
    [
      [
        [130, -14], [150, -12], [154, -28], [138, -34], [126, -26], [130, -14],
      ],
    ],
  ],
};

const WIDTH = 1920;
const HEIGHT = 1080;

const DotMap: React.FC<{
  projectionName: "equirectangular" | "mercator";
}> = ({ projectionName }) => {
  const project = React.useMemo(
    () =>
      projectionName === "mercator"
        ? mercator({ width: WIDTH, height: HEIGHT, scale: 0.82 })
        : equirectangular({ width: WIDTH, height: HEIGHT, scale: 0.82 }),
    [projectionName],
  );

  // Called ONCE — the expensive sampling never runs per frame.
  const dots = React.useMemo(
    () =>
      dotMapFromLand({
        land: SYNTHETIC_LAND,
        project,
        stepDeg: 1.8,
        latRange: [-56, 78],
      }),
    [project],
  );

  return (
    <svg width={WIDTH} height={HEIGHT}>
      {dots.map((d, i) => (
        <circle
          key={i}
          cx={d.x}
          cy={d.y}
          r={d.coastal ? 3.4 : 2.4}
          fill={d.coastal ? THEME.coast : THEME.land}
          opacity={d.coastal ? 1 : 0.55}
        />
      ))}
    </svg>
  );
};

export const ProjectionPanel: React.FC = () => (
  <Panel
    title="mercator / equirectangular"
    importPath="remotion-lib/src/geo"
    note="Projections are implemented inline — no d3-geo dependency — behind an interface d3-geo also satisfies, so a project can swap in Robinson without changing anything downstream. Mercator here; note the stretched high latitudes."
  >
    <AbsoluteFill>
      <DotMap projectionName="mercator" />
    </AbsoluteFill>
  </Panel>
);

export const DotMapPanel: React.FC = () => (
  <Panel
    title="dotMapFromLand"
    importPath="remotion-lib/src/geo"
    note="Grid sampled against land polygons; brighter, larger dots are flagged coastal (any 4-neighbour cell was water) — including the bay and the island. Land data is synthetic: the library does no I/O and ships no basemap."
  >
    <AbsoluteFill>
      <DotMap projectionName="equirectangular" />
    </AbsoluteFill>
  </Panel>
);
