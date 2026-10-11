// Cuts the bundled Natural Earth 10m layers down to one compact JSON file per
// country row (public/data/<id>.json). Run once after adding/changing a row:
//   npm run build-data
// Input: data/raw/*.geojson (Natural Earth, public domain). Output is derived
// Natural Earth data, rounded to 1e-4 degrees.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { geoContains } from 'd3-geo';
import { topology } from 'topojson-server';
import { neighbors, mesh } from 'topojson-client';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const raw = (n) => JSON.parse(fs.readFileSync(path.join(root, 'data/raw', `${n}.geojson`), 'utf8'));
const rows = JSON.parse(fs.readFileSync(path.join(root, 'src/countries.json'), 'utf8'));
const only = process.argv[2];

console.time('load');
const L = {
	countries: raw('ne_10m_admin_0_countries').features,
	places: raw('ne_10m_populated_places').features,
	roads: raw('ne_10m_roads').features,
	rivers: raw('ne_10m_rivers_lake_centerlines').features,
	lakes: raw('ne_10m_lakes').features,
	disputed: raw('ne_10m_admin_0_boundary_lines_disputed_areas').features,
};
console.timeEnd('load');

const bboxOf = (geom) => {
	let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
	const walk = (c) => {
		if (typeof c[0] === 'number') {
			if (c[0] < x0) x0 = c[0];
			if (c[0] > x1) x1 = c[0];
			if (c[1] < y0) y0 = c[1];
			if (c[1] > y1) y1 = c[1];
		} else c.forEach(walk);
	};
	walk(geom.coordinates);
	return [x0, y0, x1, y1];
};
for (const k of Object.keys(L)) for (const f of L[k]) if (f.geometry) f._bb = bboxOf(f.geometry);

const hits = (bb, w) => bb[0] <= w[2] && bb[2] >= w[0] && bb[1] <= w[3] && bb[3] >= w[1];
const q = (c) => (typeof c[0] === 'number' ? [Math.round(c[0] * 1e4) / 1e4, Math.round(c[1] * 1e4) / 1e4] : c.map(q));
const geom = (g) => ({ type: g.type, coordinates: q(g.coordinates) });
const midpoint = (g) => {
	const line = g.type === 'MultiLineString' ? g.coordinates[0] : g.coordinates;
	return line[Math.floor(line.length / 2)];
};

fs.mkdirSync(path.join(root, 'public/data'), { recursive: true });

for (const row of rows) {
	if (only && row.id !== only) continue;
	const [a, b, c, d] = row.frame;
	const midLat = (b + d) / 2, midLon = (a + c) / 2;
	const cosL = Math.cos((midLat * Math.PI) / 180);
	// Half-size of the texture window in degrees of latitude (texture is ~1.82x
	// the frame width, the name sits a little below texture centre).
	const S = Math.max((c - a) * cosL, d - b) * 1.25 + 2;
	const win = [midLon - S / cosL, Math.max(-85, midLat - S * 1.1), midLon + S / cosL, Math.min(85, midLat + S * 1.1)];

	const featured = L.countries.find((f) => f.properties.ADM0_A3 === row.iso);
	if (!featured) throw new Error(`No country ${row.iso}`);
	const cs = L.countries.filter((f) => hits(f._bb, win) && f.properties.ADM0_A3 !== 'ATA');

	// Adjacency (shared arcs) for the 4-colour neighbour scheme.
	const topo = topology({ c: { type: 'FeatureCollection', features: cs.map((f) => ({ type: 'Feature', geometry: f.geometry, properties: {} })) } }, 1e6);
	const nb = neighbors(topo.objects.c.geometries);

	const out = {
		id: row.id,
		window: win,
		borders: geom(mesh(topo, topo.objects.c, (x, y) => x !== y)),
		coast: geom(mesh(topo, topo.objects.c, (x, y) => x === y)),
		countries: cs.map((f, i) => ({
			a3: f.properties.ADM0_A3,
			name: (f.properties.NAME_EN || f.properties.NAME).replace(/^People's Republic of /, ''),
			disputed: f.properties.TYPE === 'Indeterminate',
			labelrank: f.properties.LABELRANK,
			neighbours: nb[i],
			geometry: geom(f.geometry),
		})),
		places: L.places
			.filter((f) => hits(f._bb, win))
			.map((f) => ({
				name: f.properties.NAME_EN || f.properties.NAME,
				rank: f.properties.SCALERANK,
				pop: f.properties.POP_MAX,
				cls: f.properties.FEATURECLA,
				a3: f.properties.ADM0_A3,
				lonlat: q(f.geometry.coordinates),
			})),
		roads: L.roads
			.filter((f) => f.geometry && hits(f._bb, win) && !/Ferry/.test(f.properties.type))
			.map((f) => ({
				major: f.properties.type === 'Major Highway' || f.properties.type === 'Beltway' || f.properties.scalerank <= 4 || f.properties.expressway === 1,
				inside: hits(f._bb, featured._bb) && geoContains(featured, midpoint(f.geometry)),
				geometry: geom(f.geometry),
			})),
		rivers: L.rivers
			.filter((f) => f.geometry && hits(f._bb, win) && f.properties.featurecla !== 'Lake Centerline (Intermittent)')
			.map((f) => ({ rank: f.properties.scalerank, geometry: geom(f.geometry) })),
		lakes: L.lakes.filter((f) => hits(f._bb, win)).map((f) => ({ rank: f.properties.scalerank, geometry: geom(f.geometry) })),
		disputed: L.disputed.filter((f) => f.geometry && hits(f._bb, win)).map((f) => ({ geometry: geom(f.geometry) })),
	};
	const file = path.join(root, 'public/data', `${row.id}.json`);
	fs.writeFileSync(file, JSON.stringify(out));
	console.log(row.id, `${(fs.statSync(file).size / 1e6).toFixed(1)} MB`, `countries ${out.countries.length} places ${out.places.length} roads ${out.roads.length} rivers ${out.rivers.length} disputed ${out.disputed.length}`);
}
