// Converts Natural Earth 110m land (public domain, via the world-atlas package)
// into a compact polygon list [[ring of [lon,lat]], ...] in public/land-110m.json.
// Run once: node scripts/build-land.mjs
import fs from "node:fs";
import { feature } from "topojson-client";

const topo = JSON.parse(fs.readFileSync("node_modules/world-atlas/land-110m.json", "utf8"));
const geo = feature(topo, topo.objects.land);
const polys = [];
for (const f of geo.features) {
  const g = f.geometry;
  const list = g.type === "Polygon" ? [g.coordinates] : g.coordinates;
  for (const p of list) {
    polys.push(p.map((ring) => ring.map(([x, y]) => [Math.round(x * 1000) / 1000, Math.round(y * 1000) / 1000])));
  }
}
fs.writeFileSync("public/land-110m.json", JSON.stringify(polys));
console.log("polygons:", polys.length);
