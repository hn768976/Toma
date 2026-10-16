// Builds src/data/worldDots.json from Natural Earth 1:110m land (public domain).
// Run: node scripts/build-map-dots.mjs
import { readFileSync, writeFileSync } from "node:fs";
const geo = JSON.parse(readFileSync(new URL("../data/natural-earth/ne_110m_land.geojson", import.meta.url)));
const polys = [];
for (const f of geo.features) {
  const g = f.geometry;
  if (g.type === "Polygon") polys.push(g.coordinates);
  else if (g.type === "MultiPolygon") for (const p of g.coordinates) polys.push(p);
}
const inRing = (x, y, ring) => {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
};
const onLand = (x, y) => polys.some((p) => inRing(x, y, p[0]) && !p.slice(1).some((h) => inRing(x, y, h)));
const step = 1.0, lon0 = -180, lat0 = 84, latMin = -58;
const cols = Math.round(360 / step), rows = Math.round((lat0 - latMin) / step);
const cells = [];
for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
  if (onLand(lon0 + (c + 0.5) * step, lat0 - (r + 0.5) * step)) cells.push(r * cols + c);
}
writeFileSync(new URL("../src/data/worldDots.json", import.meta.url), JSON.stringify({ source: "Natural Earth 1:110m land (public domain)", step, lon0, lat0, cols, rows, cells }));
console.log(cols, rows, cells.length);
