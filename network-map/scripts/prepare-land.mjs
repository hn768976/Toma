// Builds public/land-50m.json from Natural Earth 50m vector data (public domain).
//
//   node scripts/prepare-land.mjs
//
// Downloads ne_50m_land + ne_50m_lakes from the Natural Earth vector repo and
// rewrites them as flat coordinate rings ([lon, lat, lon, lat, ...]) rounded to
// two decimals, which is roughly 1 km at the equator - far finer than the
// smallest dot pitch either variant uses. Tiny lakes are dropped so only the
// water bodies that actually read at map scale punch holes in the dot grid.

import {writeFileSync} from 'node:fs';

const SOURCES = {
  land: 'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_50m_land.geojson',
  lakes: 'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_50m_lakes.geojson',
};

// Minimum lake bounding-box area, in square degrees, to survive the filter.
const MIN_LAKE_AREA = 0.6;

const round2 = (n) => Math.round(n * 100) / 100;

const ringsOf = (geojson) => {
  const out = [];
  for (const feature of geojson.features) {
    const {type, coordinates} = feature.geometry;
    const polygons = type === 'MultiPolygon' ? coordinates : [coordinates];
    for (const polygon of polygons) {
      for (const ring of polygon) {
        const flat = [];
        for (const [lon, lat] of ring) flat.push(round2(lon), round2(lat));
        if (flat.length >= 6) out.push(flat);
      }
    }
  }
  return out;
};

const bboxArea = (ring) => {
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (let i = 0; i < ring.length; i += 2) {
    if (ring[i] < minX) minX = ring[i];
    if (ring[i] > maxX) maxX = ring[i];
    if (ring[i + 1] < minY) minY = ring[i + 1];
    if (ring[i + 1] > maxY) maxY = ring[i + 1];
  }
  return (maxX - minX) * (maxY - minY);
};

const fetchJson = async (url) => {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url} -> HTTP ${res.status}`);
  return res.json();
};

const land = ringsOf(await fetchJson(SOURCES.land));
const lakes = ringsOf(await fetchJson(SOURCES.lakes)).filter(
  (ring) => bboxArea(ring) >= MIN_LAKE_AREA,
);

const payload = {
  source: 'Natural Earth 50m physical vectors (public domain) - naturalearthdata.com',
  precision: 2,
  land,
  lakes,
};

writeFileSync(new URL('../public/land-50m.json', import.meta.url), JSON.stringify(payload));

const points = (rings) => rings.reduce((n, r) => n + r.length / 2, 0);
console.log(`land  : ${land.length} rings, ${points(land)} points`);
console.log(`lakes : ${lakes.length} rings, ${points(lakes)} points`);
