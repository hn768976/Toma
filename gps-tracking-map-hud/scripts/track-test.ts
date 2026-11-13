// Route check + camera-bounds check for the tracking loop.
import { CITY, LOOP, MAP_W, MAP_H } from '../src/city';
import { getTrack } from '../src/city/track';
import { SegIndex } from '../src/city/geom';
const tr = getTrack();
const r = tr.route;
console.log('route length m', Math.round(r.length), 'vertices', r.pts.length / 2);
// 1) dot on road: distance from every sub-frame position to the nearest drivable road segment
const idx = new SegIndex(100);
CITY.raw.roads.forEach((rd, i) => { if (rd.cls === 'avenue' || rd.cls === 'street' || rd.cls === 'lane') idx.addPolyline(rd.pts, i); });
let maxD = 0;
for (const d of tr.dot) maxD = Math.max(maxD, idx.nearest(d.x, d.y, 50).d);
// also dense samples along the route polyline
for (let i = 0; i + 3 < r.pts.length; i += 2) for (let t = 0; t <= 1; t += 0.05) {
  const x = r.pts[i] + (r.pts[i + 2] - r.pts[i]) * t, y = r.pts[i + 1] + (r.pts[i + 3] - r.pts[i + 1]) * t;
  maxD = Math.max(maxD, idx.nearest(x, y, 50).d);
}
console.log('max distance from road (m):', maxD.toFixed(3));
// 2) turns only at junctions: every vertex with turn > 20deg must be a graph node with degree >= 3
const nodeAt = (x: number, y: number) => CITY.graph.nodes.find((n) => Math.hypot(n.x - x, n.y - y) < 0.01);
let bad = 0, turns = 0;
const n = r.pts.length / 2;
for (let i = 1; i < n - 1; i++) {
  const a = Math.atan2(r.pts[i * 2 + 1] - r.pts[i * 2 - 1], r.pts[i * 2] - r.pts[i * 2 - 2]);
  const b = Math.atan2(r.pts[i * 2 + 3] - r.pts[i * 2 + 1], r.pts[i * 2 + 2] - r.pts[i * 2]);
  let d = Math.abs(b - a); if (d > Math.PI) d = 2 * Math.PI - d;
  if (d > (20 * Math.PI) / 180) {
    turns++;
    const nd = nodeAt(r.pts[i * 2], r.pts[i * 2 + 1]);
    if (!nd || nd.edges.length < 3) { bad++; console.log('turn not at junction', i, (d * 180 / Math.PI).toFixed(1), nd?.edges.length); }
  }
}
console.log('turns > 20deg:', turns, 'not at a junction:', bad);
// 3) loop closure + speeds
const sp = tr.dot.map((d) => d.speed);
console.log('speed m/frame min/max', Math.min(...sp).toFixed(1), Math.max(...sp).toFixed(1));
console.log('frame0 vs frame600 identical (mod):', JSON.stringify(tr.dot[0]) === JSON.stringify(tr.dot[600 % LOOP]));
// 4) camera bounds (zoom given as argv)
const zoom = Number(process.argv[2] ?? 0.6), EXT = 2200;
let worst = Infinity;
tr.cam.forEach((c, f) => {
  const z = zoom * (1 + 0.07 * Math.sin((2 * Math.PI * f) / LOOP * 2 + 0.6));
  const hw = 1920 / z, hh = 1080 / z;
  for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
    const x = c.x + (sx * hw * Math.cos(c.rot) + sy * hh * Math.sin(c.rot)), y = c.y + (-sx * hw * Math.sin(c.rot) + sy * hh * Math.cos(c.rot));
    worst = Math.min(worst, x + EXT, MAP_W + EXT - x, y + EXT, MAP_H + EXT - y);
  }
});
console.log('min margin of view corners inside generated area (m):', Math.round(worst));
const rots = tr.cam.map((c) => c.rot * 180 / Math.PI);
console.log('cam rot deg range', Math.min(...rots).toFixed(1), Math.max(...rots).toFixed(1), 'center', Math.round(r.center.x), Math.round(r.center.y));
