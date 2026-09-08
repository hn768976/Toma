/**
 * Verifies that shipping lanes stay in the water.
 *
 * A sea route is sampled along the same curve the renderer draws, and every
 * sample is tested against the Natural Earth 10m land polygons (lakes punched
 * out). A shipping map with lanes over land is worse than no shipping map, so
 * this runs as `npm run check` before a render batch.
 *
 *   node scripts/check-routes.mjs [--region=<id>] [--tolerance=<deg>]
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, "..");
const { REGIONS } = await import(path.join(ROOT, "src/data/regions.ts"));
const { mapGeometry, toPlane } = await import(path.join(ROOT, "src/lib/geo.ts"));

const args = process.argv.slice(2);
const argVal = (k, d) => {
  const hit = args.find((a) => a.startsWith(`--${k}=`));
  return hit ? hit.slice(k.length + 3) : d;
};
const onlyRegion = argVal("region");
/** How far inland a sample must be before it counts, in degrees. */
const TOL = Number(argVal("tolerance", "0.25"));
const SAMPLES = 400;

const loadRings = (name) => {
  const raw = JSON.parse(fs.readFileSync(path.join(ROOT, "data", `${name}.json`), "utf8"));
  const s = raw.scale;
  return raw.rings.map((flat) => {
    const pts = new Array(flat.length / 2);
    let x = 0;
    let y = 0;
    for (let i = 0; i < flat.length; i += 2) {
      x += flat[i];
      y += flat[i + 1];
      pts[i / 2] = [x / s, y / s];
    }
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const p of pts) {
      if (p[0] < minX) minX = p[0];
      if (p[0] > maxX) maxX = p[0];
      if (p[1] < minY) minY = p[1];
      if (p[1] > maxY) maxY = p[1];
    }
    return { pts, bbox: [minX, minY, maxX, maxY] };
  });
};

/**
 * Ship canals. A lane that crosses land inside one of these is transiting a
 * canal on purpose, not cutting a corner. [lonMin, latMin, lonMax, latMax].
 */
const CANALS = [
  [32.2, 29.8, 32.7, 31.4], // Suez
  [-80.2, 8.8, -79.4, 9.5], // Panama
  [9.0, 53.8, 10.2, 54.5], // Kiel
  [22.8, 37.8, 23.1, 38.1], // Corinth
];
const inCanal = (lon, lat) =>
  CANALS.some((c) => lon >= c[0] && lon <= c[2] && lat >= c[1] && lat <= c[3]);

const LAND = loadRings("ne_10m_land");
const LAKES = loadRings("ne_10m_lakes");

const inRing = (lon, lat, ring) => {
  const b = ring.bbox;
  if (lon < b[0] || lon > b[2] || lat < b[1] || lat > b[3]) return false;
  const p = ring.pts;
  let inside = false;
  for (let i = 0, j = p.length - 1; i < p.length; j = i++) {
    const xi = p[i][0], yi = p[i][1], xj = p[j][0], yj = p[j][1];
    if (yi > lat !== yj > lat && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
};

const onLand = (lon, lat) => {
  for (const r of LAND) if (inRing(lon, lat, r)) {
    for (const l of LAKES) if (inRing(lon, lat, l)) return false;
    return true;
  }
  return false;
};

/** Land test with a tolerance ring: only flags a sample that is properly inland. */
const wellInland = (lon, lat) => {
  if (!onLand(lon, lat)) return false;
  for (const [dx, dy] of [[TOL, 0], [-TOL, 0], [0, TOL], [0, -TOL]]) {
    if (!onLand(lon + dx, lat + dy)) return false;
  }
  return true;
};

// --- curve sampling, mirroring src/lib/paths.ts in lon/lat space
const catmull = (pts, t) => {
  const n = pts.length - 1;
  const seg = Math.min(n - 1, Math.floor(t * n));
  const u = t * n - seg;
  const p0 = pts[seg === 0 ? 0 : seg - 1];
  const p1 = pts[seg];
  const p2 = pts[seg + 1];
  const p3 = pts[Math.min(pts.length - 1, seg + 2)];
  const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
  const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
  const m = 1 - u;
  return [
    m * m * m * p1[0] + 3 * m * m * u * c1[0] + 3 * m * u * u * c2[0] + u * u * u * p2[0],
    m * m * m * p1[1] + 3 * m * m * u * c1[1] + 3 * m * u * u * c2[1] + u * u * u * p2[1],
  ];
};

/** Two-point arc: built in plane space like the renderer, then mapped back. */
const arcSampler = (route, g) => {
  const a = toPlane(route.pts[0][0], route.pts[0][1], g);
  const b = toPlane(route.pts[1][0], route.pts[1][1], g);
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const len = Math.hypot(dx, dy) || 1;
  let nx = -dy / len;
  let ny = dx / len;
  const poleward = (route.pts[0][1] + route.pts[1][1]) / 2 >= 0 ? 1 : -1;
  if (ny * poleward > 0) {
    nx = -nx;
    ny = -ny;
  }
  const off = (route.bend ?? 0.12) * len;
  const c1 = [a[0] + dx / 3 + nx * off, a[1] + dy / 3 + ny * off];
  const c2 = [a[0] + (dx * 2) / 3 + nx * off, a[1] + (dy * 2) / 3 + ny * off];
  return (t) => {
    const m = 1 - t;
    const x = m * m * m * a[0] + 3 * m * m * t * c1[0] + 3 * m * t * t * c2[0] + t * t * t * b[0];
    const y = m * m * m * a[1] + 3 * m * m * t * c1[1] + 3 * m * t * t * c2[1] + t * t * t * b[1];
    return [
      g.centerLon + (x - g.originX) / g.pxPerDegLon,
      g.centerLat - (y - g.originY) / g.pxPerDegLat,
    ];
  };
};

let bad = 0;
for (const region of REGIONS) {
  if (onlyRegion && region.id !== onlyRegion) continue;
  const g = mapGeometry(region, 3840, 2160);
  const hits = [];
  for (const route of region.routes) {
    const isSea =
      route.mode === "sea" ||
      (!route.mode && (region.routeType === "shipping" || region.routeType === "mixed"));
    if (!isSea) continue;
    const sample = route.pts.length === 2 ? arcSampler(route, g) : (t) => catmull(route.pts, t);
    const inland = [];
    for (let i = 0; i <= SAMPLES; i++) {
      const [lon, lat] = sample(i / SAMPLES);
      if (!inCanal(lon, lat) && wellInland(lon, lat)) inland.push([lon.toFixed(2), lat.toFixed(2)]);
    }
    if (inland.length) {
      hits.push(`    ${route.id}: ${inland.length}/${SAMPLES + 1} samples inland, e.g. ${inland
        .slice(0, 4)
        .map((p) => `[${p[0]}, ${p[1]}]`)
        .join(" ")}`);
    }
  }
  console.log(`${region.id}: ${hits.length ? `${hits.length} route(s) cross land` : "sea routes clear"}`);
  hits.forEach((h) => console.log(h));
  bad += hits.length;
}
process.exit(bad ? 1 : 0);
