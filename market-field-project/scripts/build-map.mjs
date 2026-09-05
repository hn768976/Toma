/**
 * Regenerates src/map/land-paths.ts from Natural Earth 1:110m land polygons.
 *
 * Natural Earth vector data is in the public domain
 * (https://www.naturalearthdata.com/about/terms-of-use/), which keeps the
 * finished animation clear of third-party asset licensing.
 *
 *   node scripts/build-map.mjs path/to/ne_110m_land.geojson
 */
import { readFileSync, writeFileSync } from "node:fs";

const SRC = process.argv[2];
const OUT = new URL("../src/map/land-paths.ts", import.meta.url);

// Equirectangular projection into a 1000 x 500 box.
const W = 1000;
const H = 500;
const project = ([lon, lat]) => [
  ((lon + 180) / 360) * W,
  ((90 - lat) / 180) * H,
];

// Ramer-Douglas-Peucker.
const perpDist = (p, a, b) => {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const len = Math.hypot(dx, dy);
  if (len === 0) return Math.hypot(p[0] - a[0], p[1] - a[1]);
  return Math.abs(dy * p[0] - dx * p[1] + b[0] * a[1] - b[1] * a[0]) / len;
};

const simplify = (pts, tol) => {
  if (pts.length < 3) return pts;
  let maxD = 0;
  let idx = 0;
  for (let i = 1; i < pts.length - 1; i++) {
    const d = perpDist(pts[i], pts[0], pts[pts.length - 1]);
    if (d > maxD) {
      maxD = d;
      idx = i;
    }
  }
  if (maxD <= tol) return [pts[0], pts[pts.length - 1]];
  return [
    ...simplify(pts.slice(0, idx + 1), tol).slice(0, -1),
    ...simplify(pts.slice(idx), tol),
  ];
};

const ringArea = (pts) => {
  let a = 0;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    a += pts[j][0] * pts[i][1] - pts[i][0] * pts[j][1];
  }
  return Math.abs(a / 2);
};

const TOLERANCE = 0.7; // projection units (~2.7px at 4K)
const MIN_AREA = 1.6; // drop specks that would only render as noise
const MIN_LAT = -58; // crop Antarctica; the reference map stops above it

const geo = JSON.parse(readFileSync(SRC, "utf8"));
const rings = [];
for (const feature of geo.features) {
  const { type, coordinates } = feature.geometry;
  const polygons = type === "Polygon" ? [coordinates] : coordinates;
  for (const polygon of polygons) {
    for (const ring of polygon) {
      if (ring.every(([, lat]) => lat < MIN_LAT)) continue;
      const projected = simplify(ring.map(project), TOLERANCE);
      if (projected.length < 4) continue;
      if (ringArea(projected) < MIN_AREA) continue;
      rings.push(projected);
    }
  }
}

rings.sort((a, b) => ringArea(b) - ringArea(a));

const toPath = (pts) =>
  pts
    .map((p, i) => `${i === 0 ? "M" : "L"}${p[0].toFixed(1)} ${p[1].toFixed(1)}`)
    .join("") + "Z";

const body = rings.map((r) => `  "${toPath(r)}",`).join("\n");
const points = rings.reduce((n, r) => n + r.length, 0);

writeFileSync(
  OUT,
  `// GENERATED FILE - do not edit by hand. Run \`node scripts/build-map.mjs <geojson>\`.
//
// Source: Natural Earth 1:110m "land" polygons, which are released into the
// public domain (https://www.naturalearthdata.com/about/terms-of-use/).
// Simplified with Ramer-Douglas-Peucker and projected equirectangularly into
// the ${W} x ${H} viewBox below. ${rings.length} rings / ${points} points.
//
// The map is deliberately low-detail: it is drawn far below the charts in
// value and is only ever read as a silhouette.

export const MAP_VIEWBOX_WIDTH = ${W};
export const MAP_VIEWBOX_HEIGHT = ${H};

export const LAND_PATHS: readonly string[] = [
${body}
];
`,
);

console.log(`${rings.length} rings, ${points} points`);
