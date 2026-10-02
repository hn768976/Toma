// Builds src/data/world.json from the Natural Earth 1:110m Admin 0 countries
// file in data/ (public domain, https://www.naturalearthdata.com/).
// Output: an equirectangular outline path and a land-mask dot grid, both in a
// 1000-unit-wide map space. Antarctica is cropped (lat < -58).
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";

const src = JSON.parse(
  readFileSync(new URL("../data/ne_110m_admin_0_countries.geojson", import.meta.url)),
);
const LAT_TOP = 84;
const LAT_BOTTOM = -58;
const W = 1000;
const K = W / 360;
const H = Math.round((LAT_TOP - LAT_BOTTOM) * K * 10) / 10;
const px = (lon) => (lon + 180) * K;
const py = (lat) => (LAT_TOP - lat) * K;

const rings = [];
for (const f of src.features) {
  const g = f.geometry;
  const polys = g.type === "Polygon" ? [g.coordinates] : g.coordinates;
  for (const poly of polys) {
    for (const ring of poly) rings.push(ring);
  }
}

// Outline path
const r1 = (v) => Math.round(v * 10) / 10;
let d = "";
for (const ring of rings) {
  if (ring.every(([, lat]) => lat < LAT_BOTTOM)) continue;
  let last = "";
  let seg = "";
  let count = 0;
  for (const [lon, lat] of ring) {
    const p = `${r1(px(lon))} ${r1(py(Math.max(lat, LAT_BOTTOM)))}`;
    if (p === last) continue;
    seg += (count === 0 ? "M" : "L") + p;
    last = p;
    count++;
  }
  if (count > 2) d += seg + "Z";
}

// Land-mask dot grid (point in polygon, even-odd over all rings)
const inside = (lon, lat) => {
  let c = false;
  for (const ring of rings) {
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const [xi, yi] = ring[i];
      const [xj, yj] = ring[j];
      if (yi > lat !== yj > lat && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) c = !c;
    }
  }
  return c;
};
const STEP = 2; // degrees
const dots = [];
for (let lat = LAT_TOP - STEP / 2; lat > LAT_BOTTOM; lat -= STEP) {
  for (let lon = -180 + STEP / 2; lon < 180; lon += STEP) {
    if (inside(lon, lat)) dots.push([r1(px(lon)), r1(py(lat))]);
  }
}
const dotPath = dots.map(([x, y]) => `M${x} ${y}h0`).join("");

// Projection helper metadata so scenes can place markers by lon/lat.
mkdirSync(new URL("../src/data/", import.meta.url), { recursive: true });
writeFileSync(
  new URL("../src/data/world.json", import.meta.url),
  JSON.stringify({ width: W, height: H, latTop: LAT_TOP, latBottom: LAT_BOTTOM, step: STEP, outline: d, dots: dotPath, dotCount: dots.length }),
);
console.log(`world.json: ${W}x${H}, outline ${d.length} chars, ${dots.length} dots`);
