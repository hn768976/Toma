import { generateCity } from '../src/city/generate';
import { writeFileSync } from 'fs';
const t0 = performance.now();
const c = generateCity(Number(process.argv[2] ?? 1));
const t1 = performance.now();
const counts: Record<string, number> = {};
let segs = 0;
for (const r of c.roads) { counts[r.cls] = (counts[r.cls] ?? 0) + 1; segs += r.pts.length / 2 - 1; }
console.log('ms', (t1 - t0).toFixed(0), 'roads', c.roads.length, 'segs', segs, counts, 'districts', c.districts.length, c.districts.map(d=>d.type).join(','));
writeFileSync(process.argv[3] ?? '/tmp/city.json', JSON.stringify({ roads: c.roads, polys: c.polys }));
