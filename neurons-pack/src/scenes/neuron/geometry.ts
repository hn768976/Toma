// Procedural neuron geometry: displaced-sphere somas and tapered tubes
// along seeded branching polylines. Built once; everything that animates
// (growth, flashes) is driven by per-vertex attributes and uniforms.
import * as THREE from "three";
import { Rng, range, unitVec } from "../../lib/random";

export type V3 = [number, number, number];

export const add = (a: V3, b: V3): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
export const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
export const mul = (a: V3, s: number): V3 => [a[0] * s, a[1] * s, a[2] * s];
export const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export const cross = (a: V3, b: V3): V3 => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
export const len = (a: V3) => Math.hypot(a[0], a[1], a[2]);
export const norm = (a: V3): V3 => mul(a, 1 / (len(a) || 1));
export const lerp3 = (a: V3, b: V3, t: number): V3 => add(a, mul(sub(b, a), t));

/** Rotate v about unit axis k by angle a (Rodrigues). */
export const rotate = (v: V3, k: V3, a: number): V3 => {
  const c = Math.cos(a);
  const s = Math.sin(a);
  return add(add(mul(v, c), mul(cross(k, v), s)), mul(k, dot(k, v) * (1 - c)));
};

export const anyPerp = (d: V3): V3 => norm(Math.abs(d[0]) < 0.9 ? cross(d, [1, 0, 0]) : cross(d, [0, 1, 0]));

export type Kind = 0 | 1 | 2 | 3 | 4 | 5;
// 0 soma, 1 dendrite, 2 axon, 3 myelin, 4 terminal, 5 nucleus
export const KIND = { soma: 0, dendrite: 1, axon: 2, myelin: 3, terminal: 4, nucleus: 5 } as const;

export type Branch = {
  pts: V3[];
  radii: number[];
  /** Growth start time (s) per point (anatomy); 0 when unused. */
  grow: number[];
  parent: number;
  kind: Kind;
  depth: number;
};

/**
 * Accumulates mesh data. Attributes:
 *  position, normal, aCenter (the tube axis point, for growth collapse),
 *  aInfo = (neuron id, distance from soma, growth time, kind).
 */
export class GeoBuilder {
  pos: number[] = [];
  nrm: number[] = [];
  ctr: number[] = [];
  info: number[] = [];
  idx: number[] = [];

  vertex(p: V3, n: V3, c: V3, info: [number, number, number, number]) {
    this.pos.push(...p);
    this.nrm.push(...n);
    this.ctr.push(...c);
    this.info.push(...info);
    return this.pos.length / 3 - 1;
  }

  /** Tapered tube along pts with parallel-transport frames. */
  tube(
    pts: V3[],
    radii: number[],
    sides: number,
    info: (i: number) => [number, number, number, number],
  ) {
    const n = pts.length;
    if (n < 2) return;
    let t0 = norm(sub(pts[1], pts[0]));
    let nA = anyPerp(t0);
    const base = this.pos.length / 3;
    for (let i = 0; i < n; i++) {
      const t = norm(i === 0 ? sub(pts[1], pts[0]) : i === n - 1 ? sub(pts[n - 1], pts[n - 2]) : sub(pts[i + 1], pts[i - 1]));
      // Parallel transport of the frame normal.
      const ax = cross(t0, t);
      const s = len(ax);
      if (s > 1e-6) nA = rotate(nA, mul(ax, 1 / s), Math.atan2(s, dot(t0, t)));
      nA = norm(sub(nA, mul(t, dot(nA, t))));
      const bA = cross(t, nA);
      t0 = t;
      const inf = info(i);
      for (let k = 0; k < sides; k++) {
        const a = (k / sides) * Math.PI * 2;
        const dir = add(mul(nA, Math.cos(a)), mul(bA, Math.sin(a)));
        this.vertex(add(pts[i], mul(dir, radii[i])), dir, pts[i], inf);
      }
    }
    for (let i = 0; i < n - 1; i++) {
      for (let k = 0; k < sides; k++) {
        const a = base + i * sides + k;
        const b = base + i * sides + ((k + 1) % sides);
        const c = a + sides;
        const d = b + sides;
        this.idx.push(a, c, b, b, c, d);
      }
    }
    // Rounded cap at the far end (a cone to the last point).
    const tip = this.vertex(pts[n - 1], norm(sub(pts[n - 1], pts[n - 2])), pts[n - 1], info(n - 1));
    const last = base + (n - 1) * sides;
    for (let k = 0; k < sides; k++) this.idx.push(last + k, tip, last + ((k + 1) % sides));
  }

  /** Displaced icosphere. */
  blob(center: V3, radius: (d: V3) => number, detail: number, info: (d: V3) => [number, number, number, number]) {
    const g = new THREE.IcosahedronGeometry(1, detail);
    const p = g.getAttribute("position");
    // Merge duplicated vertices so normals are smooth.
    const key = (i: number) => `${p.getX(i).toFixed(5)},${p.getY(i).toFixed(5)},${p.getZ(i).toFixed(5)}`;
    const map = new Map<string, number>();
    const verts: V3[] = [];
    const remap: number[] = [];
    for (let i = 0; i < p.count; i++) {
      const k = key(i);
      let j = map.get(k);
      if (j === undefined) {
        j = verts.length;
        map.set(k, j);
        verts.push([p.getX(i), p.getY(i), p.getZ(i)]);
      }
      remap.push(j);
    }
    const disp = verts.map((d) => add(center, mul(d, radius(d))));
    // Vertex normals from faces.
    const normals = verts.map(() => [0, 0, 0] as V3);
    for (let i = 0; i < remap.length; i += 3) {
      const a = remap[i];
      const b = remap[i + 1];
      const c = remap[i + 2];
      const fn = cross(sub(disp[b], disp[a]), sub(disp[c], disp[a]));
      normals[a] = add(normals[a], fn);
      normals[b] = add(normals[b], fn);
      normals[c] = add(normals[c], fn);
    }
    const base = this.pos.length / 3;
    verts.forEach((d, i) => this.vertex(disp[i], norm(normals[i]), center, info(d)));
    for (let i = 0; i < remap.length; i += 3) this.idx.push(base + remap[i], base + remap[i + 1], base + remap[i + 2]);
    g.dispose();
  }

  build() {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute("normal", new THREE.Float32BufferAttribute(this.nrm, 3));
    g.setAttribute("aCenter", new THREE.Float32BufferAttribute(this.ctr, 3));
    g.setAttribute("aInfo", new THREE.Float32BufferAttribute(this.info, 4));
    g.setIndex(this.idx);
    g.computeBoundingSphere();
    return g;
  }
}

export type DendriteOpts = {
  rootLen: number;
  rootRadius: number;
  tipRadius: number;
  maxDepth: number;
  segLen: number;
  wiggle: number;
  spread: [number, number];
  shrink: [number, number];
  /** Pull applied to directions (e.g. up for apical dendrites). */
  bias?: V3;
};

/** Seeded branching: returns branches (first = root) appended to `out`. */
export const growTree = (
  rng: Rng,
  out: Branch[],
  start: V3,
  dir: V3,
  o: DendriteOpts,
  kind: Kind,
  parent = -1,
  depth = 0,
  length = o.rootLen,
  radius = o.rootRadius,
) => {
  const nSeg = Math.max(3, Math.round(length / o.segLen));
  const pts: V3[] = [start];
  const radii: number[] = [radius];
  let d = norm(dir);
  let p = start;
  const endR = depth >= o.maxDepth ? o.tipRadius : Math.max(o.tipRadius, radius * 0.72);
  for (let i = 1; i <= nSeg; i++) {
    d = norm(add(add(d, mul(unitVec(rng), o.wiggle)), o.bias ?? [0, 0, 0]));
    p = add(p, mul(d, length / nSeg));
    pts.push(p);
    const t = i / nSeg;
    radii.push(radius + (endR - radius) * Math.pow(t, depth >= o.maxDepth ? 0.7 : 1));
  }
  const me = out.length;
  out.push({ pts, radii, grow: pts.map(() => 0), parent, kind, depth });
  if (depth < o.maxDepth) {
    const nKids = rng() < 0.2 ? 3 : 2;
    const ax0 = anyPerp(d);
    const spin = rng() * Math.PI * 2;
    for (let k = 0; k < nKids; k++) {
      const axis = rotate(ax0, d, spin + (k * Math.PI * 2) / nKids);
      const kd = rotate(d, axis, range(rng, o.spread[0], o.spread[1]));
      growTree(rng, out, p, kd, o, kind, me, depth + 1, length * range(rng, o.shrink[0], o.shrink[1]), endR * 0.92);
    }
  }
  return me;
};

/** Polyline from a branch's tip back to the tree root (inclusive). */
export const pathToRoot = (branches: Branch[], b: number): V3[] => {
  const pts: V3[] = [];
  let cur = b;
  while (cur >= 0) {
    const br = branches[cur];
    for (let i = br.pts.length - 1; i >= 0; i--) {
      if (pts.length && i === br.pts.length - 1) continue; // shared joint
      pts.push(br.pts[i]);
    }
    cur = br.parent;
  }
  return pts;
};

/** Arc-length sampler for a polyline. */
export const polyline = (pts: V3[]) => {
  const cum = [0];
  for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + len(sub(pts[i], pts[i - 1])));
  const total = cum[cum.length - 1];
  return {
    total,
    at: (u: number): V3 => {
      const s = Math.min(Math.max(u, 0), 1) * total;
      let lo = 0;
      let hi = cum.length - 1;
      while (hi - lo > 1) {
        const m = (lo + hi) >> 1;
        if (cum[m] <= s) lo = m;
        else hi = m;
      }
      const t = (s - cum[lo]) / Math.max(1e-9, cum[hi] - cum[lo]);
      return lerp3(pts[lo], pts[hi], t);
    },
  };
};
