import { Delaunay } from "d3-delaunay";
import * as THREE from "three";
import { feature } from "topojson-client";
import type { Topology, GeometryCollection } from "topojson-specification";
import land from "../data/land-110m.json";
import { mulberry32, range } from "../lib/random";

// Natural Earth 1:110m land (public domain, via world-atlas). Outlines only.
// Map plane: x east, z south, y up. Miller projection, 1 unit = 10 degrees of
// longitude, so the map is 36 units wide.
const K = 18 / Math.PI;
export const project = (lon: number, lat: number) => {
  const phi = (lat * Math.PI) / 180;
  const y = 1.25 * Math.log(Math.tan(Math.PI / 4 + 0.4 * phi));
  return new THREE.Vector2(((lon * Math.PI) / 180) * K, -y * K);
};

type Ring = THREE.Vector2[];

const ringArea = (r: Ring) => {
  let a = 0;
  for (let i = 0; i < r.length; i++) {
    const p = r[i];
    const q = r[(i + 1) % r.length];
    a += p.x * q.y - q.x * p.y;
  }
  return a / 2;
};

const chaikin = (r: Ring, iters: number) => {
  let cur = r;
  for (let k = 0; k < iters; k++) {
    const out: Ring = [];
    for (let i = 0; i < cur.length; i++) {
      const p = cur[i];
      const q = cur[(i + 1) % cur.length];
      out.push(p.clone().lerp(q, 0.25), p.clone().lerp(q, 0.75));
    }
    cur = out;
  }
  return cur;
};

// Closed ring resampled at a fixed spacing.
const resample = (r: Ring, step: number) => {
  const pts = [...r, r[0]];
  const out: Ring = [];
  let carry = 0;
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i];
    const b = pts[i + 1];
    const len = a.distanceTo(b);
    let d = carry;
    while (d < len) {
      out.push(a.clone().lerp(b, d / len));
      d += step;
    }
    carry = d - len;
  }
  return out;
};

export const inside = (p: THREE.Vector2, r: Ring) => {
  let c = false;
  for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
    const a = r[i];
    const b = r[j];
    if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) c = !c;
  }
  return c;
};

export type WorldMap = {
  rings: Ring[]; // smoothed, resampled land outlines (no Antarctica, no tiny islands)
  fillEdges: [THREE.Vector2, THREE.Vector2][];
  fillVerts: THREE.Vector2[];
  fillTris: [THREE.Vector2, THREE.Vector2, THREE.Vector2][];
  bounds: THREE.Box2;
};

export function buildWorldMap(seed: number): WorldMap {
  const topo = land as unknown as Topology<{ land: GeometryCollection }>;
  const fc = feature(topo, topo.objects.land) as unknown as GeoJSON.FeatureCollection<GeoJSON.MultiPolygon | GeoJSON.Polygon>;
  const rings: Ring[] = [];
  for (const f of fc.features) {
    const polys = f.geometry.type === "Polygon" ? [f.geometry.coordinates] : f.geometry.coordinates;
    for (const poly of polys) {
      // Unwrap longitudes so rings crossing the antimeridian stay continuous
      // (Chukotka, Fiji, Wrangel); their few points past 180 deg sit just off the edge.
      let shift = 0;
      const outer = poly[0].map((c, i, arr) => {
        if (i > 0) {
          const d = c[0] - arr[i - 1][0];
          if (d > 180) shift -= 360;
          else if (d < -180) shift += 360;
        }
        return [c[0] + shift, c[1]];
      });
      // Put the bulk of the ring back in [-180, 180].
      const inRange = (k: number) => outer.filter((c) => Math.abs(c[0] + k) <= 180).length;
      const best = [-360, 0, 360].reduce((a, b) => (inRange(b) > inRange(a) ? b : a), 0);
      outer.forEach((c) => (c[0] += best));
      if (Math.max(...outer.map((c) => c[1])) < -58) continue; // Antarctica
      // Skip rings that wrap the antimeridian badly (tiny Chukotka slivers).
      const proj = outer.map(([lon, lat]) => project(lon, lat));
      const area = Math.abs(ringArea(proj));
      if (area < 0.5) continue;
      rings.push(resample(chaikin(proj, 2), 0.04));
    }
  }
  const r = mulberry32(seed);
  const fillEdges: [THREE.Vector2, THREE.Vector2][] = [];
  const fillVerts: THREE.Vector2[] = [];
  const fillTris: [THREE.Vector2, THREE.Vector2, THREE.Vector2][] = [];
  for (const ring of rings) {
    const area = Math.abs(ringArea(ring));
    if (area < 0.6) continue;
    const box = new THREE.Box2().setFromPoints(ring);
    const pts: THREE.Vector2[] = [];
    // Boundary samples.
    const bstep = 0.85;
    const stride = Math.max(1, Math.round(bstep / 0.04));
    for (let i = 0; i < ring.length; i += stride) pts.push(ring[i]);
    // Jittered interior samples.
    const s = 1.05;
    for (let x = box.min.x; x < box.max.x; x += s) {
      for (let y = box.min.y; y < box.max.y; y += s) {
        const p = new THREE.Vector2(x + range(r, 0.1, 0.9) * s, y + range(r, 0.1, 0.9) * s);
        if (inside(p, ring)) {
          pts.push(p);
          fillVerts.push(p);
        }
      }
    }
    if (pts.length < 3) continue;
    const d = Delaunay.from(pts.map((p) => [p.x, p.y]));
    const seen = new Set<string>();
    for (let t = 0; t < d.triangles.length; t += 3) {
      const ia = d.triangles[t], ib = d.triangles[t + 1], ic = d.triangles[t + 2];
      const a = pts[ia], b = pts[ib], c = pts[ic];
      const cen = a.clone().add(b).add(c).multiplyScalar(1 / 3);
      if (!inside(cen, ring)) continue;
      // Drop slivers along the coast.
      if (Math.max(a.distanceTo(b), b.distanceTo(c), c.distanceTo(a)) > 3.2) continue;
      fillTris.push([a, b, c]);
      for (const [u, v] of [[ia, ib], [ib, ic], [ic, ia]]) {
        const key = u < v ? `${u}-${v}` : `${v}-${u}`;
        if (seen.has(key)) continue;
        seen.add(key);
        fillEdges.push([pts[u], pts[v]]);
      }
    }
  }
  const bounds = new THREE.Box2();
  rings.forEach((rg) => rg.forEach((p) => bounds.expandByPoint(p)));
  return { rings, fillEdges, fillVerts, fillTris, bounds };
}

// Offsets a closed ring along its normals (for the parallel fibre strands).
export const offsetRing = (ring: Ring, d: number, wobble: number, seed: number) => {
  const n = ring.length;
  return ring.map((p, i) => {
    const a = ring[(i - 1 + n) % n];
    const b = ring[(i + 1) % n];
    const t = b.clone().sub(a).normalize();
    const nrm = new THREE.Vector2(-t.y, t.x);
    const w = wobble * Math.sin(i * 0.37 + seed * 5.1) * Math.sin(i * 0.11 + seed * 2.3);
    return p.clone().addScaledVector(nrm, d + w);
  });
};
