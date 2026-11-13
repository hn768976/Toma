import { CITY } from '../src/city';
import { writeFileSync } from 'fs';
const t0 = performance.now();
console.log('nodes', CITY.graph.nodes.length, 'edges', CITY.graph.edges.length, 'routes', CITY.routes.map(r => [Math.round(r.length), r.pts.length/2, r.junctions.length]), 'pois', CITY.pois.length);
const deg: Record<number, number> = {};
for (const n of CITY.graph.nodes) deg[n.edges.length] = (deg[n.edges.length] ?? 0) + 1;
console.log('degree hist', deg);
writeFileSync(process.argv[2], JSON.stringify({ roads: [...CITY.raw.roads, ...CITY.routes.map(r => ({ cls: 'route', pts: r.pts }))], polys: CITY.raw.polys, pois: CITY.pois }));
