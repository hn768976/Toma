// Rebuilds the trimmed Natural Earth files in public/data/ from the raw
// Natural Earth downloads in raw/ (see public/data/SOURCES.md for URLs).
// Coordinates are copied unchanged; only unused attribute columns are dropped.
//
//   node scripts/extract-ne.mjs
import fs from 'node:fs';
import path from 'node:path';

const RAW = 'raw';
const OUT = 'public/data';
fs.mkdirSync(OUT, {recursive: true});

const KEEP = ['ADMIN', 'NAME', 'ADM0_A3', 'ISO_A3', 'ISO_A3_EH', 'CONTINENT', 'SUBREGION', 'TYPE', 'SOVEREIGNT'];
const read = (f) => JSON.parse(fs.readFileSync(path.join(RAW, f), 'utf8'));
const trim = (f) => ({
  type: 'Feature',
  properties: Object.fromEntries(KEEP.map((k) => [k, f.properties[k]])),
  geometry: f.geometry,
});
const write = (name, features) => {
  const fc = {type: 'FeatureCollection', name, features};
  fs.writeFileSync(path.join(OUT, `${name}.geojson`), JSON.stringify(fc));
  console.log(`${name}: ${features.length} features`);
};

// 1:50m, default worldview: every country (the main source).
write('ne_50m_admin_0_countries', read('ne_50m_admin_0_countries.geojson').features.map(trim));

// 1:10m, default worldview: only the small countries that look blocky at 50m.
const TEN_M = ['NLD', 'CHE', 'ARE'];
write(
  'ne_10m_admin_0_countries_subset',
  read('ne_10m_admin_0_countries.geojson').features.filter((f) => TEN_M.includes(f.properties.ADM0_A3)).map(trim),
);

// Worldview files (Natural Earth only publishes these at 1:10m).
write(
  'ne_10m_admin_0_countries_ind_IND',
  read('ne_10m_admin_0_countries_ind.geojson').features.filter((f) => f.properties.ADM0_A3 === 'IND').map(trim),
);
write(
  'ne_10m_admin_0_countries_pak_PAK',
  read('ne_10m_admin_0_countries_pak.geojson').features.filter((f) => f.properties.ADM0_A3 === 'PAK').map(trim),
);

// Dotted world map for the floor: a land mask on a regular lon/lat grid,
// sampled from 1:110m land with an even-odd point-in-polygon test.
const STEP = 0.75; // degrees between dots
const cols = Math.round(360 / STEP);
const rows = Math.round(180 / STEP);
const land = read('ne_110m_land.geojson').features;
const rings = [];
for (const f of land) {
  const polys = f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates;
  for (const p of polys) for (const r of p) rings.push(r);
}
const inside = (x, y) => {
  let c = false;
  for (const r of rings) {
    for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
      const [xi, yi] = r[i];
      const [xj, yj] = r[j];
      if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c;
    }
  }
  return c;
};
let mask = '';
for (let j = 0; j < rows; j++) {
  const lat = 90 - (j + 0.5) * STEP;
  for (let i = 0; i < cols; i++) {
    const lon = -180 + (i + 0.5) * STEP;
    mask += lat < -60 ? '0' : inside(lon, lat) ? '1' : '0';
  }
}
fs.writeFileSync(path.join(OUT, 'world-dots.json'), JSON.stringify({step: STEP, cols, rows, mask}));
console.log(`world-dots: ${cols}x${rows}, ${[...mask].filter((c) => c === '1').length} land dots`);
