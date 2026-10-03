// Converts the Natural Earth TopoJSON (via the world-atlas package) into a
// compact JSON of polygon rings / border lines in [lon, lat] degrees.
// Run once: `node scripts/build-map-data.mjs`. Output is committed in public/data.
import { readFileSync, writeFileSync } from "node:fs";
import { feature, mesh } from "topojson-client";

const r = (v) => Math.round(v * 100) / 100;
const ring = (pts) => pts.map(([x, y]) => [r(x), r(y)]);

const build = (res) => {
  const land = JSON.parse(readFileSync(`node_modules/world-atlas/land-${res}.json`, "utf8"));
  const countries = JSON.parse(readFileSync(`node_modules/world-atlas/countries-${res}.json`, "utf8"));
  const landGeo = feature(land, land.objects.land);
  const polys = [];
  for (const f of landGeo.features) {
    const g = f.geometry;
    const list = g.type === "Polygon" ? [g.coordinates] : g.coordinates;
    for (const p of list) polys.push(p.map(ring));
  }
  const borders = mesh(countries, countries.objects.countries, (a, b) => a !== b);
  const lines = borders.coordinates.map(ring);
  writeFileSync(`public/data/world-${res}.json`, JSON.stringify({ land: polys, borders: lines }));
  console.log(res, polys.length, "polygons", lines.length, "border lines");
};
build("50m");
build("110m");
