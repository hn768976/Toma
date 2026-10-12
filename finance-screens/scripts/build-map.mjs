// Turns the Natural Earth 1:110m land polygons (public domain) into a dot grid:
// one cell per dot, "1" wherever the cell centre is on land.
// Equirectangular projection, lon -180..180, lat 84..-58 (Antarctica cropped).
// Output: public/data/world-dots.json  { cols, rows, latTop, latBottom, rows: string[] }
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const geo = JSON.parse(
  readFileSync(join(root, "data/naturalearth/ne_110m_land.geojson"), "utf8"),
);

const COLS = 168; // dot pitch ~0.6% of the map width
const LAT_TOP = 84;
const LAT_BOTTOM = -58;
const pitch = 360 / COLS;
const ROWS = Math.round((LAT_TOP - LAT_BOTTOM) / pitch);

const polys = [];
for (const f of geo.features) {
  const g = f.geometry;
  if (g.type === "Polygon") polys.push(g.coordinates);
  else if (g.type === "MultiPolygon") polys.push(...g.coordinates);
}

const inRing = (x, y, ring) => {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
};
const onLand = (x, y) =>
  polys.some(
    (p) => inRing(x, y, p[0]) && !p.slice(1).some((h) => inRing(x, y, h)),
  );

const rows = [];
for (let r = 0; r < ROWS; r++) {
  const lat = LAT_TOP - (r + 0.5) * pitch;
  let s = "";
  for (let c = 0; c < COLS; c++) {
    const lon = -180 + (c + 0.5) * pitch;
    s += onLand(lon, lat) ? "1" : "0";
  }
  rows.push(s);
}

mkdirSync(join(root, "public/data"), { recursive: true });
writeFileSync(
  join(root, "public/data/world-dots.json"),
  JSON.stringify({
    source: "Natural Earth 1:110m land (public domain)",
    cols: COLS,
    rows: ROWS,
    latTop: LAT_TOP,
    latBottom: LAT_BOTTOM,
    grid: rows,
  }),
);
console.log(`world-dots.json: ${COLS}x${ROWS}, land cells:`, rows.join("").split("1").length - 1);
