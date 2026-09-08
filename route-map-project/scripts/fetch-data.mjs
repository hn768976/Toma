/**
 * Re-fetches and re-bakes the public-domain source data in `data/`.
 *
 * You do not need to run this — `data/` is committed so the project renders
 * offline. It exists so the provenance of every byte in `data/` is executable
 * rather than a claim in a README.
 *
 * Sources (both public domain):
 *   Natural Earth 1:10m vectors      https://www.naturalearthdata.com
 *     mirrored as GeoJSON at         https://github.com/nvkelso/natural-earth-vector
 *   NASA Blue Marble Next Generation https://visibleearth.nasa.gov (Visible Earth)
 *     4096x2048 equirectangular copy of the NASA topo+bathy composite
 *
 * Vectors are simplified (Douglas-Peucker, ~0.01 deg) and delta-encoded at
 * 1e-3 deg, which takes the four layers from ~28 MB of GeoJSON to ~2.6 MB.
 *
 *   node scripts/fetch-data.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DATA = path.join(HERE, "..", "data");

const NE_BASE =
  "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson";
const BLUE_MARBLE =
  "https://raw.githubusercontent.com/vasturiano/three-globe/master/example/img/earth-blue-marble.jpg";

/** [output name, Natural Earth layer, simplify tolerance (deg), min feature extent, is polygon] */
const LAYERS = [
  ["ne_10m_land", "ne_10m_land", 0.01, 0.06, true],
  ["ne_10m_coastline", "ne_10m_coastline", 0.01, 0.06, false],
  ["ne_10m_borders", "ne_10m_admin_0_boundary_lines_land", 0.014, 0.1, false],
  ["ne_10m_lakes", "ne_10m_lakes", 0.012, 0.12, true],
];

const perpDist = (p, a, b) => {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const l2 = dx * dx + dy * dy;
  if (l2 === 0) return Math.hypot(p[0] - a[0], p[1] - a[1]);
  const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / l2));
  return Math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dy));
};

const rdp = (pts, tol) => {
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
  return rdp(pts.slice(0, idx + 1), tol).slice(0, -1).concat(rdp(pts.slice(idx), tol));
};

const rings = (fc) => {
  const out = [];
  const walk = (g) => {
    if (!g) return;
    if (g.type === "GeometryCollection") g.geometries.forEach(walk);
    else if (g.type === "LineString") out.push(g.coordinates);
    else if (g.type === "MultiLineString") g.coordinates.forEach((c) => out.push(c));
    else if (g.type === "Polygon") g.coordinates.forEach((c) => out.push(c));
    else if (g.type === "MultiPolygon") g.coordinates.forEach((p) => p.forEach((c) => out.push(c)));
  };
  fc.features.forEach((f) => walk(f.geometry));
  return out;
};

const extent = (r) => {
  let a = Infinity, b = Infinity, c = -Infinity, d = -Infinity;
  for (const p of r) {
    if (p[0] < a) a = p[0];
    if (p[1] < b) b = p[1];
    if (p[0] > c) c = p[0];
    if (p[1] > d) d = p[1];
  }
  return Math.max(c - a, d - b);
};

const get = async (url) => {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} for ${url}`);
  return res;
};

fs.mkdirSync(DATA, { recursive: true });

for (const [name, layer, tol, minExtent, isPolygon] of LAYERS) {
  const fc = await (await get(`${NE_BASE}/${layer}.geojson`)).json();
  const simplified = rings(fc)
    .filter((r) => extent(r) >= minExtent)
    .map((r) => rdp(r, tol))
    .filter((r) => r.length >= (isPolygon ? 4 : 2));
  const encoded = simplified.map((r) => {
    const flat = [];
    let px = 0;
    let py = 0;
    for (const p of r) {
      const x = Math.round(p[0] * 1000);
      const y = Math.round(p[1] * 1000);
      flat.push(x - px, y - py);
      px = x;
      py = y;
    }
    return flat;
  });
  const dest = path.join(DATA, `${name}.json`);
  fs.writeFileSync(
    dest,
    JSON.stringify({ scale: 1000, delta: true, polygon: isPolygon, rings: encoded }),
  );
  console.log(`${name.padEnd(22)} ${String(simplified.length).padStart(5)} rings  ${(fs.statSync(dest).size / 1e6).toFixed(2)} MB`);
}

const img = Buffer.from(await (await get(BLUE_MARBLE)).arrayBuffer());
fs.writeFileSync(path.join(DATA, "bluemarble-4096x2048.jpg"), img);
console.log(`bluemarble-4096x2048.jpg  ${(img.length / 1e6).toFixed(2)} MB`);
console.log("\nNow run: npm run bake");
