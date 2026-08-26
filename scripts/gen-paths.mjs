import { geoPath, geoMercator } from 'd3-geo';
import { feature } from 'topojson-client';
import { createRequire } from 'module';
import fs from 'fs';
const require = createRequire(import.meta.url);
const topo = require('world-atlas/countries-50m.json');
const fc = feature(topo, topo.objects.countries);
const byId = (id) => fc.features.find((f) => f.id === id);

// ── ring area on the sphere (approx, planar in degrees — fine for filtering)
const ringArea = (ring) => {
  let a = 0;
  for (let i = 0, n = ring.length; i < n; i++) {
    const [x1, y1] = ring[i];
    const [x2, y2] = ring[(i + 1) % n];
    a += x1 * y2 - x2 * y1;
  }
  return Math.abs(a / 2);
};
const centroid = (ring) => {
  let x = 0, y = 0;
  for (const p of ring) { x += p[0]; y += p[1]; }
  return [x / ring.length, y / ring.length];
};

// ── collect outer rings of a set of features, filter, return MultiPolygon
const rings = (features) => {
  const out = [];
  for (const f of features) {
    const g = f.geometry;
    const polys = g.type === 'Polygon' ? [g.coordinates] : g.coordinates;
    for (const p of polys) out.push(p[0]);
  }
  return out;
};

const build = (name, features, { minArea = 0.05, keep = null } = {}) => {
  let rs = rings(features);
  if (keep) rs = rs.filter((r) => keep(centroid(r), ringArea(r)));
  rs = rs.filter((r) => ringArea(r) >= minArea);
  rs.sort((a, b) => ringArea(b) - ringArea(a));
  let geo = { type: 'MultiPolygon', coordinates: rs.map((r) => [r]) };
  const proj = geoMercator().fitSize([1000, 1000], geo);
  // project + simplify in screen space so detail is tuned to the 1000-unit box
  const simplify = (pts, tol) => {
    if (pts.length < 4) return pts;
    const keep = new Array(pts.length).fill(false);
    keep[0] = keep[pts.length - 1] = true;
    const stack = [[0, pts.length - 1]];
    while (stack.length) {
      const [i, j] = stack.pop();
      let maxD = 0, idx = -1;
      const [ax, ay] = pts[i], [bx, by] = pts[j];
      const dx = bx - ax, dy = by - ay;
      const len = Math.hypot(dx, dy) || 1e-9;
      for (let k = i + 1; k < j; k++) {
        const d = Math.abs((pts[k][0] - ax) * dy - (pts[k][1] - ay) * dx) / len;
        if (d > maxD) { maxD = d; idx = k; }
      }
      if (maxD > tol && idx > 0) { keep[idx] = true; stack.push([i, idx], [idx, j]); }
    }
    return pts.filter((_, k) => keep[k]);
  };
  const simplifyRing = (pts, tol) => {
    // drop the duplicated closing vertex, then DP each half of the ring so the
    // degenerate start==end chord can't collapse the whole thing
    let r = pts.slice();
    if (r.length > 1 && r[0][0] === r[r.length - 1][0] && r[0][1] === r[r.length - 1][1]) r.pop();
    if (r.length < 8) return r;
    let far = 1, fd = -1;
    for (let k = 1; k < r.length; k++) {
      const d = Math.hypot(r[k][0] - r[0][0], r[k][1] - r[0][1]);
      if (d > fd) { fd = d; far = k; }
    }
    const a = simplify(r.slice(0, far + 1), tol);
    const b = simplify(r.slice(far), tol);
    return a.concat(b.slice(1));
  };
  const projected = geo.coordinates.map(([ring]) => {
    const pts = ring.map((c) => proj(c)).filter((p) => p && isFinite(p[0]) && isFinite(p[1]));
    const s = simplifyRing(pts, 0.7);
    return [s.length >= 4 ? s.concat([s[0]]) : pts];
  });
  geo = { type: 'MultiPolygon', coordinates: projected };
  const path = geoPath();
  const d = path(geo);
  const b = path.bounds(geo);
  // round to 1dp
  const dr = d.replace(/-?\d+\.\d+/g, (m) => String(Math.round(parseFloat(m) * 10) / 10));
  return {
    name,
    d: dr,
    parts: rs.length,
    bounds: b.map((p) => p.map((v) => Math.round(v * 10) / 10)),
    bytes: dr.length,
  };
};

const uk = build('uk', [byId('826'), byId('372')], { minArea: 0.06 });
const usa = build('usa', [byId('840')], {
  minArea: 0.08,
  keep: ([lon, lat]) => lon > -128 && lon < -65 && lat > 23 && lat < 52,
});
const china = build('china', [byId('156')], { minArea: 0.6 });

const res = { uk, usa, china };
for (const k of Object.keys(res)) {
  const r = res[k];
  console.log(k, 'parts=' + r.parts, 'bytes=' + r.bytes, 'bounds=' + JSON.stringify(r.bounds));
}
fs.writeFileSync('scripts/paths.json', JSON.stringify(res, null, 1));
