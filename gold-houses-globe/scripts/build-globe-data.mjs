// Rasterises Natural Earth land polygons onto an even dot grid on the sphere,
// derives city-light intensities from Natural Earth populated places, and picks
// pin cities. Output: public/data/globe.json (compact, loaded by the globe look).
//
// Run: node scripts/build-globe-data.mjs   (deterministic; no randomness)
import { readFileSync, writeFileSync } from "node:fs";

const land = JSON.parse(readFileSync("data-src/ne_50m_land.geojson", "utf8"));
const places = JSON.parse(
  readFileSync("data-src/ne_10m_populated_places_simple.geojson", "utf8"),
);

// ---- polygons with bounding boxes --------------------------------------
const polys = [];
for (const f of land.features) {
  const g = f.geometry;
  const list = g.type === "Polygon" ? [g.coordinates] : g.coordinates;
  for (const rings of list) {
    let minX = 1e9, minY = 1e9, maxX = -1e9, maxY = -1e9;
    for (const [x, y] of rings[0]) {
      minX = Math.min(minX, x); maxX = Math.max(maxX, x);
      minY = Math.min(minY, y); maxY = Math.max(maxY, y);
    }
    polys.push({ rings, minX, minY, maxX, maxY });
  }
}
const inRing = (x, y, ring) => {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
};
const isLand = (lon, lat) => {
  for (const p of polys) {
    if (lon < p.minX || lon > p.maxX || lat < p.minY || lat > p.maxY) continue;
    if (!inRing(lon, lat, p.rings[0])) continue;
    let hole = false;
    for (let k = 1; k < p.rings.length; k++) if (inRing(lon, lat, p.rings[k])) { hole = true; break; }
    if (!hole) return true;
  }
  return false;
};

// ---- populated places --------------------------------------------------
const cities = places.features
  .map((f) => ({
    lon: f.geometry.coordinates[0],
    lat: f.geometry.coordinates[1],
    pop: f.properties.pop_max || 0,
    name: f.properties.nameascii,
  }))
  .filter((c) => c.pop > 50000);

const toVec = (lon, lat) => {
  const la = (lat * Math.PI) / 180, lo = (lon * Math.PI) / 180;
  return [Math.cos(la) * Math.cos(lo), Math.sin(la), Math.cos(la) * Math.sin(lo)];
};
const cityVec = cities.map((c) => ({ ...c, v: toVec(c.lon, c.lat) }));

// bucket cities by 5° cell for fast lookup
const bucket = new Map();
const key = (lo, la) => `${Math.floor(lo / 5)},${Math.floor(la / 5)}`;
for (const c of cityVec) {
  const k = key(c.lon, c.lat);
  if (!bucket.has(k)) bucket.set(k, []);
  bucket.get(k).push(c);
}
const near = (lon, lat) => {
  const out = [];
  const bx = Math.floor(lon / 5), by = Math.floor(lat / 5);
  for (let dx = -1; dx <= 1; dx++)
    for (let dy = -1; dy <= 1; dy++) {
      let x = bx + dx;
      if (x < -36) x += 72;
      if (x >= 36) x -= 72;
      const b = bucket.get(`${x},${by + dy}`);
      if (b) out.push(...b);
    }
  return out;
};

// ---- dot grid ----------------------------------------------------------
const STEP = 0.42; // degrees between rows / along rows (at the equator)
const dots = []; // [lon, lat, cityIntensity]
for (let lat = -84 + STEP / 2; lat < 84; lat += STEP) {
  const n = Math.max(1, Math.round((360 / STEP) * Math.cos((lat * Math.PI) / 180)));
  for (let i = 0; i < n; i++) {
    const lon = -180 + (i + 0.5) * (360 / n);
    if (!isLand(lon, lat)) continue;
    const v = toVec(lon, lat);
    let light = 0;
    for (const c of near(lon, lat)) {
      const d = 1 - (v[0] * c.v[0] + v[1] * c.v[1] + v[2] * c.v[2]);
      const ang = Math.sqrt(Math.max(0, 2 * d)) * (180 / Math.PI); // degrees
      const radius = 0.35 + 0.9 * Math.log10(c.pop / 50000 + 1);
      if (ang < radius) light = Math.max(light, (1 - ang / radius) * Math.min(1, Math.log10(c.pop) / 7));
    }
    dots.push([+lon.toFixed(2), +lat.toFixed(2), +light.toFixed(2)]);
  }
}

// ---- pins: big cities with angular separation --------------------------
const sorted = [...cityVec].sort((a, b) => b.pop - a.pop);
const pins = [];
for (const c of sorted) {
  if (pins.length >= 40) break;
  if (pins.every((p) => p.v[0] * c.v[0] + p.v[1] * c.v[1] + p.v[2] * c.v[2] < Math.cos((9 * Math.PI) / 180)))
    pins.push(c);
}

writeFileSync(
  "public/data/globe.json",
  JSON.stringify({
    step: STEP,
    dots: dots.flat(),
    pins: pins.map((p) => [+p.lon.toFixed(2), +p.lat.toFixed(2)]),
  }),
);
console.log(`land dots ${dots.length}, lit ${dots.filter((d) => d[2] > 0).length}, pins ${pins.length}`);
