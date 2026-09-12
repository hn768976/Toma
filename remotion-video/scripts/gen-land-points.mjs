// Bakes an equal-area lat/lon sample of Earth's landmass into src/globe/land-points.json.
// Run with: node scripts/gen-land-points.mjs
import {readFileSync, writeFileSync, mkdirSync} from 'fs';
import {feature} from 'topojson-client';
import {geoContains} from 'd3-geo';

const topo = JSON.parse(
  readFileSync(new URL('../node_modules/world-atlas/land-110m.json', import.meta.url), 'utf8'),
);
const land = feature(topo, topo.objects.land);

// Equal-area sampling: latitude bands of constant spacing, longitude count scaled by cos(lat)
// so dots stay evenly spread instead of bunching at the poles.
const LAT_STEP = 1.15;
const points = [];
for (let lat = -88; lat <= 88; lat += LAT_STEP) {
  const circumference = Math.cos((lat * Math.PI) / 180);
  const count = Math.max(6, Math.round((360 / LAT_STEP) * circumference));
  for (let i = 0; i < count; i++) {
    const lon = -180 + (360 * i) / count;
    if (geoContains(land, [lon, lat])) {
      points.push([Math.round(lon * 10) / 10, Math.round(lat * 10) / 10]);
    }
  }
}

mkdirSync(new URL('../src/globe', import.meta.url), {recursive: true});
writeFileSync(
  new URL('../src/globe/land-points.json', import.meta.url),
  JSON.stringify(points),
);
console.log(`wrote ${points.length} land points`);
