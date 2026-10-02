// Turns one data row into a flat, normalised map outline:
//   select features -> clip / main-territory filter -> antimeridian fix ->
//   per-shape projection -> drop small islands -> topology merge (outline)
//   + mesh (inner borders) -> simplify -> normalise to a unit box.
// Pure and deterministic: same row + same data => same numbers.
import {geoAzimuthalEqualArea, geoConicConformal, geoMercator, type GeoProjection} from 'd3-geo';
import polylabel from 'polylabel';
import {merge, mesh} from 'topojson-client';
import {topology} from 'topojson-server';
import type {BBox, Member, Row} from '../data/rows';

type Pt = [number, number];
type Ring = Pt[];
type Poly = Ring[]; // [outer, ...holes]

export type GeoFeature = {
  type: 'Feature';
  properties: Record<string, string | number | null>;
  geometry: {type: 'Polygon'; coordinates: Poly} | {type: 'MultiPolygon'; coordinates: Poly[]};
};
export type GeoFC = {type: 'FeatureCollection'; features: GeoFeature[]};
export type Sources = {'50m': GeoFC; '10m': GeoFC; IND: GeoFC; PAK: GeoFC};

export type ShapeData = {
  /** Polygons in a unit box: x east, y north, centred on the bbox centre, max(w, h) = 1. */
  polygons: Poly[];
  /** Inner borders between member countries (regions only), same space. */
  borders: Ring[];
  w: number;
  h: number;
  /** Most interior point of the largest polygon (where the flag's focus lands). */
  anchor: Pt;
  /** Shape centre in lon/lat (used to place the dotted world map under it). */
  center: Pt;
  projection: string;
  stats: {members: number; polygons: number; vertices: number};
};

const DEFAULT_MIN_ISLAND = 0.003;

// ------------------------------------------------------------------ helpers
const codeOf = (f: GeoFeature) => String(f.properties.ADM0_A3);
const polysOf = (f: GeoFeature): Poly[] =>
  f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates;

const ringArea = (r: Ring) => {
  let a = 0;
  for (let i = 0, j = r.length - 1; i < r.length; j = i++) a += (r[j][0] + r[i][0]) * (r[j][1] - r[i][1]);
  return a / 2;
};
const polyArea = (p: Poly) => Math.abs(ringArea(p[0])) - p.slice(1).reduce((s, h) => s + Math.abs(ringArea(h)), 0);
const ringMean = (r: Ring): Pt => {
  let x = 0;
  let y = 0;
  for (const p of r) {
    x += p[0];
    y += p[1];
  }
  return [x / r.length, y / r.length];
};
const inBox = (p: Pt, b?: BBox) => !b || (p[0] >= b[0] && p[0] <= b[2] && p[1] >= b[1] && p[1] <= b[3]);

/** Sutherland–Hodgman clip of a ring against an axis-aligned box. */
const clipRing = (ring: Ring, b: BBox): Ring => {
  const edges: [(p: Pt) => boolean, (a: Pt, c: Pt) => Pt][] = [
    [(p) => p[0] >= b[0], (a, c) => [b[0], a[1] + ((c[1] - a[1]) * (b[0] - a[0])) / (c[0] - a[0])]],
    [(p) => p[0] <= b[2], (a, c) => [b[2], a[1] + ((c[1] - a[1]) * (b[2] - a[0])) / (c[0] - a[0])]],
    [(p) => p[1] >= b[1], (a, c) => [a[0] + ((c[0] - a[0]) * (b[1] - a[1])) / (c[1] - a[1]), b[1]]],
    [(p) => p[1] <= b[3], (a, c) => [a[0] + ((c[0] - a[0]) * (b[3] - a[1])) / (c[1] - a[1]), b[3]]],
  ];
  let out = ring.slice(0, -1); // open ring
  for (const [inside, cut] of edges) {
    const input = out;
    out = [];
    for (let i = 0; i < input.length; i++) {
      const cur = input[i];
      const prev = input[(i + input.length - 1) % input.length];
      if (inside(cur)) {
        if (!inside(prev)) out.push(cut(prev, cur));
        out.push(cur);
      } else if (inside(prev)) out.push(cut(prev, cur));
    }
    if (out.length === 0) break;
  }
  return out.length >= 3 ? [...out, out[0]] : [];
};

/** Iterative Douglas–Peucker. Keeps first/last points. */
const simplifyLine = (pts: Ring, tol: number): Ring => {
  if (pts.length <= 3) return pts;
  const keep = new Uint8Array(pts.length);
  keep[0] = 1;
  keep[pts.length - 1] = 1;
  const stack: [number, number][] = [[0, pts.length - 1]];
  const tol2 = tol * tol;
  while (stack.length) {
    const [a, b] = stack.pop()!;
    const [ax, ay] = pts[a];
    const [bx, by] = pts[b];
    const dx = bx - ax;
    const dy = by - ay;
    const len2 = dx * dx + dy * dy;
    let maxD = -1;
    let idx = -1;
    for (let i = a + 1; i < b; i++) {
      const [px, py] = pts[i];
      let d2: number;
      if (len2 === 0) d2 = (px - ax) ** 2 + (py - ay) ** 2;
      else {
        const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len2));
        d2 = (px - ax - t * dx) ** 2 + (py - ay - t * dy) ** 2;
      }
      if (d2 > maxD) {
        maxD = d2;
        idx = i;
      }
    }
    if (maxD > tol2 && idx > 0) {
      keep[idx] = 1;
      stack.push([a, idx], [idx, b]);
    }
  }
  return pts.filter((_, i) => keep[i]);
};
const simplifyRing = (ring: Ring, tol: number): Ring => {
  // Split the closed ring at its farthest point from the start so DP keeps the shape.
  const open = ring.slice(0, -1);
  if (open.length < 8) return ring;
  let far = 0;
  let best = -1;
  for (let i = 0; i < open.length; i++) {
    const d = (open[i][0] - open[0][0]) ** 2 + (open[i][1] - open[0][1]) ** 2;
    if (d > best) {
      best = d;
      far = i;
    }
  }
  const a = simplifyLine(open.slice(0, far + 1), tol);
  const b = simplifyLine([...open.slice(far), open[0]], tol);
  const out = [...a, ...b.slice(1)];
  // A tiny island that collapsed: keep the original instead of losing it.
  if (out.length < 4 || Math.abs(ringArea(out)) < Math.abs(ringArea(ring)) * 0.5) return ring;
  return out;
};
const dedupe = (r: Ring): Ring => r.filter((p, i) => i === 0 || p[0] !== r[i - 1][0] || p[1] !== r[i - 1][1]);

// ------------------------------------------------------------------ selection
type Picked = {code: string; polys: Poly[]; member?: Exclude<Member, string>};

const pickFeatures = (row: Row, src: Sources): Picked[] => {
  const world = src['50m'].features;
  const findIn = (fc: GeoFeature[], iso: string) => {
    const byAdm = fc.filter((f) => codeOf(f) === iso);
    if (byAdm.length) return byAdm;
    return fc.filter((f) => f.properties.ISO_A3 === iso);
  };
  if (row.kind === 'country') {
    const fc = row.worldview ? src[row.worldview].features : row.scale === '10m' ? src['10m'].features : world;
    const found = findIn(fc, row.iso!);
    if (!found.length) throw new Error(`No Natural Earth feature for ${row.iso}`);
    return found.map((f) => ({code: codeOf(f), polys: polysOf(f)}));
  }
  const out: Picked[] = [];
  if (row.continent) {
    for (const f of world) {
      if (f.properties.CONTINENT === row.continent && !(row.exclude ?? []).includes(codeOf(f))) {
        out.push({code: codeOf(f), polys: polysOf(f)});
      }
    }
  }
  for (const m of row.members ?? []) {
    const iso = typeof m === 'string' ? m : m.iso;
    const found = findIn(world, iso);
    if (!found.length) throw new Error(`No Natural Earth feature for member ${iso} of ${row.id}`);
    for (const f of found) out.push({code: codeOf(f), polys: polysOf(f), member: typeof m === 'string' ? undefined : m});
  }
  return out;
};

// ------------------------------------------------------------------ projection
const chooseProjection = (row: Row, lonLat: Pt[]): {proj: GeoProjection; name: string; center: Pt} => {
  let minLon = Infinity;
  let maxLon = -Infinity;
  let minLat = Infinity;
  let maxLat = -Infinity;
  for (const [x, y] of lonLat) {
    minLon = Math.min(minLon, x);
    maxLon = Math.max(maxLon, x);
    minLat = Math.min(minLat, y);
    maxLat = Math.max(maxLat, y);
  }
  const lon0 = row.centerLon ?? (minLon + maxLon) / 2;
  const lat0 = (minLat + maxLat) / 2;
  const latSpan = maxLat - minLat;
  const sameHemisphere = minLat * maxLat > 0;
  let kind = row.projection;
  if (!kind) {
    if (Math.abs(lat0) >= 25 && sameHemisphere && latSpan <= 70) kind = 'conic';
    else if (latSpan > 45 || !sameHemisphere && latSpan > 40) kind = 'azimuthal';
    else kind = 'mercator';
  }
  const center: Pt = [lon0, lat0];
  if (kind === 'polar-south') return {proj: geoAzimuthalEqualArea().rotate([0, 90, 0]).scale(1000).translate([0, 0]), name: 'azimuthal equal-area, south pole', center: [0, -90]};
  if (kind === 'azimuthal') return {proj: geoAzimuthalEqualArea().rotate([-lon0, -lat0]).scale(1000).translate([0, 0]), name: `azimuthal equal-area @ ${lon0.toFixed(1)},${lat0.toFixed(1)}`, center};
  if (kind === 'mercator') return {proj: geoMercator().rotate([-lon0, 0]).scale(1000).translate([0, 0]), name: `mercator @ ${lon0.toFixed(1)}`, center};
  const p1 = minLat + latSpan / 6;
  const p2 = maxLat - latSpan / 6;
  return {
    proj: geoConicConformal().rotate([-lon0, 0]).parallels([p1, p2]).scale(1000).translate([0, 0]),
    name: `conic conformal @ ${lon0.toFixed(1)}, parallels ${p1.toFixed(1)}/${p2.toFixed(1)}`,
    center,
  };
};

// ------------------------------------------------------------------ main
export const buildShape = (row: Row, src: Sources): ShapeData => {
  const picked = pickFeatures(row, src);

  // 1. Clip, antimeridian shift, main-territory filter (all in lon/lat).
  const shiftRing = (r: Ring): Ring => {
    if (row.centerLon === undefined) return r;
    const m = ringMean(r)[0];
    const k = Math.round((row.centerLon - m) / 360);
    return k === 0 ? r : r.map(([x, y]) => [x + k * 360, y] as Pt);
  };
  const polar = row.projection === 'polar-south';
  const members: {code: string; polys: Poly[]}[] = [];
  for (const p of picked) {
    const polys: Poly[] = [];
    for (let poly of p.polys) {
      if (p.member?.clip) {
        poly = poly.map((r) => clipRing(r, p.member!.clip!)).filter((r) => r.length >= 4);
        if (!poly.length) continue;
      }
      if (polar) {
        // Antarctica's ring runs along the ±180° cut down to the pole; drop that
        // seam so the azimuthal projection yields one clean outline.
        poly = poly.map((r) => {
          const kept = r.filter(([x, y]) => y > -89.9 && !(Math.abs(x) === 180 && y < -84));
          return [...kept.slice(0, -1), kept[0]];
        });
      }
      poly = poly.map(shiftRing);
      const c = ringMean(poly[0]);
      if (!inBox(c, row.within) || !inBox(c, p.member?.within)) continue;
      polys.push(poly);
    }
    if (polys.length) members.push({code: p.code, polys});
  }
  if (!members.length) throw new Error(`Row ${row.id}: nothing left after filtering`);

  // 2. Project pointwise (no resampling/clipping, so shared borders stay identical).
  const allPts: Pt[] = [];
  for (const m of members) for (const poly of m.polys) for (const p of poly[0]) allPts.push(p);
  const {proj, name, center} = chooseProjection(row, allPts);
  const project = (r: Ring): Ring =>
    dedupe(
      r.map(([x, y]) => {
        const q = proj([x, y])!;
        return [q[0], -q[1]] as Pt; // flip: y north
      }),
    );
  const projected = members.map((m) => ({code: m.code, polys: m.polys.map((poly) => poly.map(project))}));

  // 3. Drop small islands (fraction of total area), keeping each member's largest piece if asked.
  const total = projected.reduce((s, m) => s + m.polys.reduce((t, p) => t + polyArea(p), 0), 0);
  const minIsland = (row.minIsland ?? DEFAULT_MIN_ISLAND) * total;
  const features = [];
  for (const m of projected) {
    const areas = m.polys.map(polyArea);
    const largest = areas.indexOf(Math.max(...areas));
    const keep = m.polys
      .filter((_, i) => areas[i] >= minIsland || (row.keepAllMembers && i === largest) || (row.kind === 'country' && i === largest))
      .map((poly) => [poly[0], ...poly.slice(1).filter((h) => Math.abs(ringArea(h)) >= minIsland * 0.5)]);
    if (keep.length) features.push({type: 'Feature' as const, properties: {code: m.code}, geometry: {type: 'MultiPolygon' as const, coordinates: keep}});
  }

  // 4. Merge into one outline; inner borders from the shared arcs.
  const topo = topology({shapes: {type: 'FeatureCollection', features}} as never);
  const shapesObj = (topo.objects as Record<string, never>).shapes as unknown as {type: 'GeometryCollection'; geometries: never[]};
  const merged = merge(topo as never, shapesObj.geometries) as unknown as {coordinates: Poly[]};
  const inner =
    row.kind === 'region'
      ? ((mesh(topo as never, shapesObj as never, (a: unknown, b: unknown) => a !== b) as unknown as {coordinates: Ring[]}).coordinates ?? [])
      : [];

  // 5. Simplify and normalise to a unit box.
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const poly of merged.coordinates)
    for (const [x, y] of poly[0]) {
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
    }
  const size = Math.max(maxX - minX, maxY - minY);
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  const norm = (r: Ring): Ring => r.map(([x, y]) => [(x - cx) / size, (y - cy) / size] as Pt);
  const tol = 0.0006;
  const polygons: Poly[] = merged.coordinates
    .map((poly) => poly.map((r) => simplifyRing(norm(r), tol)))
    .filter((poly) => polyArea(poly) > 0);
  const borders = inner.map((l) => simplifyLine(norm(l), tol)).filter((l) => l.length >= 2);

  const areas = polygons.map(polyArea);
  const main = polygons[areas.indexOf(Math.max(...areas))];
  const lab = polylabel(main as number[][][], 0.001);
  return {
    polygons,
    borders,
    w: (maxX - minX) / size,
    h: (maxY - minY) / size,
    anchor: [lab[0], lab[1]],
    center: center,
    projection: name,
    stats: {members: members.length, polygons: polygons.length, vertices: polygons.reduce((s, p) => s + p.reduce((t, r) => t + r.length, 0), 0)},
  };
};
