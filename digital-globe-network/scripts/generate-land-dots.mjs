// Generates the dotted-continent point set used by the globe.
// Run with: npm run generate:land  (the output, src/data/land-dots.json, is
// committed, so this only needs re-running to change the dot density.)
//
// Method: scanline even-odd fill of the Natural Earth land polygons
// (world-atlas, 50m) on rows of constant latitude; dots per row ~ cos(lat)
// so the halftone is roughly equal-area.
import { readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { feature } from "topojson-client";

const require = createRequire(import.meta.url);
const topo = JSON.parse(readFileSync(require.resolve("world-atlas/land-50m.json"), "utf8"));
const land = feature(topo, topo.objects.land);

const rings = [];
for (const f of land.features) {
  const g = f.geometry;
  const polys = g.type === "Polygon" ? [g.coordinates] : g.coordinates;
  for (const poly of polys) for (const ring of poly) rings.push(ring);
}

// Per ring: unwrap longitudes so rings crossing the antimeridian stay
// continuous, then keep their non-horizontal edges.
const ringEdges = rings.map((ring) => {
  const pts = [];
  let prev = null;
  for (const [x, y] of ring) {
    let ux = x;
    if (prev !== null) {
      while (ux - prev > 180) ux -= 360;
      while (ux - prev < -180) ux += 360;
    }
    pts.push([ux, y]);
    prev = ux;
  }
  const e = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const [x0, y0] = pts[i];
    const [x1, y1] = pts[i + 1];
    if (y0 !== y1) e.push([x0, y0, x1, y1]);
  }
  return e;
});

const rowCache = new Map();
const rowCrossings = (lat) => {
  const key = lat.toFixed(4);
  const hit = rowCache.get(key);
  if (hit) return hit;
  const rowXs = [];
  for (const edges of ringEdges) {
    const xs = [];
    for (const [x0, y0, x1, y1] of edges) {
      if (lat >= Math.min(y0, y1) && lat < Math.max(y0, y1)) {
        xs.push(x0 + ((lat - y0) * (x1 - x0)) / (y1 - y0));
      }
    }
    if (xs.length) rowXs.push(xs);
  }
  rowCache.set(key, rowXs);
  return rowXs;
};
const odd = (xs, lon) => {
  let c = 0;
  for (const x of xs) if (x < lon) c++;
  return c % 2 === 1;
};
const isLand = (lon, lat) => {
  let parity = false;
  for (const xs of rowCrossings(lat)) {
    if (odd(xs, lon) || odd(xs, lon + 360) || odd(xs, lon - 360)) parity = !parity;
  }
  return parity;
};

// Output: flat array of [lon, lat, coast] triplets. `coast` = 1 when a
// neighbouring sample ~1.2 deg away is ocean (used for the warm coastline glow).
const STEP = Number(process.env.LAND_STEP ?? 0.55); // degrees between dots
const C = 1.2;
const out = [];
for (let lat = -82; lat <= 83; lat += STEP) {
  const n = Math.max(1, Math.round((360 / STEP) * Math.cos((lat * Math.PI) / 180)));
  const offset = (Math.abs(Math.round(lat / STEP)) % 2) * 0.5;
  for (let i = 0; i < n; i++) {
    const lon = -180 + ((i + offset) * 360) / n;
    if (!isLand(lon, lat)) continue;
    const coast =
      !isLand(lon + C / Math.max(0.2, Math.cos((lat * Math.PI) / 180)), lat) ||
      !isLand(lon - C / Math.max(0.2, Math.cos((lat * Math.PI) / 180)), lat) ||
      !isLand(lon, lat + C) ||
      !isLand(lon, lat - C);
    out.push(Math.round(lon * 100) / 100, Math.round(lat * 100) / 100, coast ? 1 : 0);
  }
}
writeFileSync(new URL("../src/data/land-dots.json", import.meta.url), JSON.stringify(out));
console.log(`land dots: ${out.length / 3}`);
