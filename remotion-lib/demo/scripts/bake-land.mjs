/**
 * Bakes world-atlas land-110m TopoJSON into a static GeoJSON module.
 *
 * Run once; the output is committed. The demo then renders with no network
 * access and no build-time dependency on world-atlas.
 *   node scripts/bake-land.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { feature } from 'topojson-client';

const topo = JSON.parse(
  readFileSync(new URL('../node_modules/world-atlas/land-110m.json', import.meta.url)),
);
const geo = feature(topo, topo.objects.land);

// Round coordinates to 2dp — well below dot-map resolution, and it roughly
// halves the file.
const round = (v) =>
  Array.isArray(v) ? v.map(round) : typeof v === 'number' ? Math.round(v * 100) / 100 : v;
geo.features = geo.features.map((f) => ({
  type: 'Feature',
  properties: { name: 'land' },
  geometry: { ...f.geometry, coordinates: round(f.geometry.coordinates) },
}));

writeFileSync(
  new URL('../src/land.ts', import.meta.url),
  `/**\n * Natural Earth land at 110m, baked from world-atlas.\n *\n * Committed so the demo renders offline and deterministically. Regenerate with\n * \`node scripts/bake-land.mjs\`. The LIBRARY bundles no data — this is demo\n * fixture only, and real projects pass their own GeoJSON to fitProjection.\n */\nexport const LAND = ${JSON.stringify(geo)} as const;\n`,
);
console.log('wrote src/land.ts');
