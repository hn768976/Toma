// Builds the compact TopoJSON files in public/data from Natural Earth GeoJSON.
// Natural Earth is public domain (see public/data/LICENSE-NaturalEarth.md).
//
//   node scripts/prepare-data.mjs [cacheDir]
//
// Downloads the source GeoJSON from the natural-earth-vector repository into
// cacheDir (default ./.ne-cache) when missing, keeps only the fields the map
// needs, and writes quantized TopoJSON. The output is committed, so a normal
// install never needs to run this.
import fs from "node:fs";
import path from "node:path";
import { topology } from "topojson-server";

const cache = path.resolve(process.argv[2] ?? ".ne-cache");
const out = path.resolve("public/data");
const BASE = "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson";
fs.mkdirSync(cache, { recursive: true });
fs.mkdirSync(out, { recursive: true });

const load = async (name) => {
  const file = path.join(cache, `${name}.geojson`);
  if (!fs.existsSync(file)) {
    console.log(`downloading ${name}`);
    const res = await fetch(`${BASE}/${name}.geojson`);
    if (!res.ok) throw new Error(`${name}: HTTP ${res.status}`);
    fs.writeFileSync(file, Buffer.from(await res.arrayBuffer()));
  }
  return JSON.parse(fs.readFileSync(file, "utf8"));
};

const pick = (fc, keep, filter = () => true, rename = {}) => ({
  type: "FeatureCollection",
  features: fc.features.filter(filter).map((f) => {
    const p = {};
    for (const k of keep) {
      const v = f.properties[k];
      if (v !== null && v !== undefined && v !== "") p[rename[k] ?? k] = v;
    }
    return { type: "Feature", properties: p, geometry: f.geometry };
  }),
});

const round = (n, d) => Math.round(n * 10 ** d) / 10 ** d;
const write = (file, objects, q) => {
  const topo = topology(objects, q);
  const json = JSON.stringify(topo);
  fs.writeFileSync(path.join(out, file), json);
  console.log(`${file}: ${(json.length / 1e6).toFixed(2)} MB`);
};

const COUNTRY_KEYS = ["NAME", "NAME_LONG", "ABBREV", "ADM0_A3", "TYPE", "LABELRANK", "MIN_LABEL", "LABEL_X", "LABEL_Y", "CONTINENT"];

// Detailed set for the regional maps.
{
  const countries = pick(await load("ne_10m_admin_0_countries"), COUNTRY_KEYS);
  const borders = pick(await load("ne_10m_admin_0_boundary_lines_land"), ["FEATURECLA"]);
  const claims = pick(await load("ne_10m_admin_0_boundary_lines_disputed_areas"), ["FEATURECLA"]);
  const disputed = pick(await load("ne_10m_admin_0_disputed_areas"), ["NAME", "TYPE", "ADM0_A3"]);
  const lakes = pick(await load("ne_10m_lakes"), ["name", "scalerank"], (f) => f.properties.scalerank <= 7);
  const marine = pick(await load("ne_10m_geography_marine_polys"), ["name", "featurecla", "scalerank", "min_label"], (f) => f.properties.name);
  const coast = pick(await load("ne_10m_coastline"), []);
  write("ne_10m_regional.json", { countries, borders, claims, disputed, lakes, marine, coast }, 1e6);
}

// Lighter set for the world map.
{
  const countries = pick(await load("ne_50m_admin_0_countries"), COUNTRY_KEYS);
  const borders = pick(await load("ne_50m_admin_0_boundary_lines_land"), ["FEATURECLA"]);
  const disputed = pick(await load("ne_10m_admin_0_disputed_areas"), ["NAME", "TYPE", "ADM0_A3"]);
  const lakes = pick(await load("ne_50m_lakes"), ["name", "scalerank"], (f) => f.properties.scalerank <= 3);
  const marine = pick(await load("ne_50m_geography_marine_polys"), ["name", "featurecla", "scalerank", "min_label"], (f) => f.properties.name);
  const coast = pick(await load("ne_50m_coastline"), []);
  write("ne_50m_world.json", { countries, borders, disputed, lakes, marine, coast }, 1e5);
}

// States and provinces, North America only.
{
  const na = (f) => ["USA", "CAN"].includes(f.properties.adm0_a3);
  const states = pick(await load("ne_50m_admin_1_states_provinces"), ["name", "postal", "adm0_a3", "labelrank", "latitude", "longitude", "area_sqkm"], na);
  // the lines file spells the field ADM0_A3
  const lines = pick(await load("ne_50m_admin_1_states_provinces_lines"), ["ADM0_A3"], (f) => ["USA", "CAN"].includes(f.properties.ADM0_A3), { ADM0_A3: "adm0_a3" });
  write("ne_50m_admin1_na.json", { states, lines }, 1e6);
}

// Populated places as plain JSON points.
{
  const places = (await load("ne_10m_populated_places_simple")).features
    .filter((f) => f.properties.featurecla === "Admin-0 capital" || f.properties.featurecla === "Admin-1 capital" || f.properties.pop_max >= 250000)
    .map((f) => {
      const p = f.properties;
      return {
        name: p.name,
        lon: round(f.geometry.coordinates[0], 4),
        lat: round(f.geometry.coordinates[1], 4),
        pop: p.pop_max,
        cap: p.featurecla === "Admin-0 capital" ? 2 : p.featurecla === "Admin-1 capital" ? 1 : 0,
        rank: p.scalerank,
        a3: p.adm0_a3,
      };
    });
  fs.writeFileSync(path.join(out, "ne_10m_places.json"), JSON.stringify(places));
  console.log(`ne_10m_places.json: ${places.length} places`);
}

fs.copyFileSync(path.join(cache, "LICENSE.md"), path.join(out, "LICENSE-NaturalEarth.md"));
