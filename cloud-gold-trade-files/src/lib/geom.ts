import * as THREE from "three";

/** Polyline with cumulative lengths, for placing things along it. */
export class Path {
  pts: THREE.Vector3[];
  cum: number[];
  length: number;
  constructor(pts: THREE.Vector3[]) {
    this.pts = pts;
    this.cum = [0];
    for (let i = 1; i < pts.length; i++) this.cum.push(this.cum[i - 1] + pts[i].distanceTo(pts[i - 1]));
    this.length = this.cum[this.cum.length - 1];
  }
  /** point at arc length s (clamped) */
  at(s: number, out = new THREE.Vector3()): THREE.Vector3 {
    s = Math.min(this.length, Math.max(0, s));
    let i = 1;
    while (i < this.cum.length - 1 && this.cum[i] < s) i++;
    const seg = this.cum[i] - this.cum[i - 1] || 1;
    return out.lerpVectors(this.pts[i - 1], this.pts[i], (s - this.cum[i - 1]) / seg);
  }
}

/** Offset a 2D polyline (x,z) sideways by d with mitred corners. */
export function offsetPolyline(pts: [number, number][], d: number): [number, number][] {
  const n = pts.length;
  const out: [number, number][] = [];
  for (let i = 0; i < n; i++) {
    const p = pts[i];
    const a = pts[Math.max(0, i - 1)];
    const b = pts[Math.min(n - 1, i + 1)];
    const t1 = i > 0 ? norm2([p[0] - a[0], p[1] - a[1]]) : norm2([b[0] - p[0], b[1] - p[1]]);
    const t2 = i < n - 1 ? norm2([b[0] - p[0], b[1] - p[1]]) : t1;
    const n1: [number, number] = [-t1[1], t1[0]];
    const n2: [number, number] = [-t2[1], t2[0]];
    const m = norm2([n1[0] + n2[0], n1[1] + n2[1]]);
    const k = 1 / Math.max(0.2, m[0] * n1[0] + m[1] * n1[1]);
    out.push([p[0] + m[0] * d * k, p[1] + m[1] * d * k]);
  }
  return out;
}
function norm2(v: [number, number]): [number, number] {
  const l = Math.hypot(v[0], v[1]) || 1;
  return [v[0] / l, v[1] / l];
}

/**
 * Flat ribbon lying on a plane (normal `up`) along a polyline. Attributes:
 * uv.x = arc length, uv.y = -1..1 across.
 */
export function flatRibbon(pts: THREE.Vector3[], width: number, up = new THREE.Vector3(0, 1, 0)): THREE.BufferGeometry {
  const pos: number[] = [];
  const uv: number[] = [];
  const idx: number[] = [];
  let s = 0;
  const side = new THREE.Vector3();
  const t = new THREE.Vector3();
  for (let i = 0; i < pts.length; i++) {
    if (i > 0) s += pts[i].distanceTo(pts[i - 1]);
    const a = pts[Math.max(0, i - 1)];
    const b = pts[Math.min(pts.length - 1, i + 1)];
    t.subVectors(b, a).normalize();
    side.crossVectors(up, t).normalize();
    // mitre
    let k = 1;
    if (i > 0 && i < pts.length - 1) {
      const t1 = new THREE.Vector3().subVectors(pts[i], a).normalize();
      const s1 = new THREE.Vector3().crossVectors(up, t1).normalize();
      k = 1 / Math.max(0.3, s1.dot(side));
    }
    for (const sg of [-1, 1]) {
      const p = pts[i].clone().addScaledVector(side, (sg * width * k) / 2);
      pos.push(p.x, p.y, p.z);
      uv.push(s, sg);
    }
    if (i < pts.length - 1) {
      const q = i * 2;
      idx.push(q, q + 1, q + 2, q + 1, q + 3, q + 2);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  return g;
}

/** Merge geometries with identical attribute sets (position/uv[/normal]). */
export function mergeSimple(geos: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const names = Object.keys(geos[0].attributes);
  const out = new THREE.BufferGeometry();
  let vcount = 0;
  const idx: number[] = [];
  const data: Record<string, number[]> = {};
  names.forEach((n) => (data[n] = []));
  for (const g of geos) {
    const gi = g.index ? Array.from(g.index.array) : Array.from({ length: g.attributes.position.count }, (_, i) => i);
    gi.forEach((i) => idx.push(i + vcount));
    names.forEach((n) => {
      const arr = (g.attributes[n] as THREE.BufferAttribute).array;
      const dst = data[n];
      for (let i = 0; i < arr.length; i++) dst.push(arr[i]);
    });
    vcount += g.attributes.position.count;
  }
  names.forEach((n) => out.setAttribute(n, new THREE.Float32BufferAttribute(data[n], geos[0].attributes[n].itemSize)));
  out.setIndex(idx);
  return out;
}
