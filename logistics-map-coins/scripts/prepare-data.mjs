// One-off converter: Natural Earth shapefiles + shaded-relief raster -> compact
// files in public/data. The converted output is shipped, so this only needs to
// run if you want to rebuild it.
//
//   npm i --no-save shapefile@0.6.6 sharp
//   node scripts/prepare-data.mjs <dir-with-unzipped-natural-earth-files>
import fs from 'node:fs';
import path from 'node:path';
import * as shapefile from 'shapefile';
import sharp from 'sharp';

const src = process.argv[2];
if (!src) throw new Error('usage: node scripts/prepare-data.mjs <natural-earth-dir>');
const out = path.resolve('public/data');
fs.mkdirSync(out, {recursive: true});

const r2 = (v) => Math.round(v * 100) / 100;

// Polygons as [ [ring, ring...], ... ] with rings as flat [lon,lat,lon,lat...].
async function polygons(file) {
  const reader = await shapefile.open(path.join(src, file));
  const polys = [];
  for (;;) {
    const {done, value} = await reader.read();
    if (done) break;
    const g = value.geometry;
    const list = g.type === 'Polygon' ? [g.coordinates] : g.coordinates;
    for (const poly of list) {
      polys.push(poly.map((ring) => ring.flatMap(([x, y]) => [r2(x), r2(y)])));
    }
  }
  return polys;
}
const land = await polygons('ne_50m_land.shp');
fs.writeFileSync(path.join(out, 'ne_50m_land.json'), JSON.stringify(land));
const land110 = await polygons('ne_110m_land.shp');
fs.writeFileSync(path.join(out, 'ne_110m_land.json'), JSON.stringify(land110));
const countries = await polygons('ne_50m_admin_0_countries.shp');
fs.writeFileSync(path.join(out, 'ne_50m_admin_0_countries.json'), JSON.stringify(countries));

// Populated places: [lon, lat, pop_max, scalerank]; names are dropped on purpose
// (the animations only use invented codes).
const places = [];
const ps = await shapefile.open(path.join(src, 'ne_10m_populated_places_simple.shp'));
for (;;) {
  const {done, value} = await ps.read();
  if (done) break;
  const p = value.properties;
  if ((p.pop_max ?? 0) < 150000) continue;
  const [x, y] = value.geometry.coordinates;
  places.push([r2(x), r2(y), p.pop_max, p.scalerank]);
}
places.sort((a, b) => b[2] - a[2]);
fs.writeFileSync(path.join(out, 'ne_10m_populated_places.json'), JSON.stringify(places));

// Shaded relief: 10800x5400 grey TIFF -> 8192x4096 grey PNG (WebGL texture limit).
await sharp(path.join(src, 'GRAY_50M_SR.tif'), {limitInputPixels: false})
  .resize(8192, 4096, {kernel: 'lanczos3'})
  .greyscale()
  .png({compressionLevel: 9})
  .toFile(path.join(out, 'gray_50m_sr.png'));

console.log(`land ${land.length} polys, countries ${countries.length}, places ${places.length}`);
