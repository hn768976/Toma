import * as THREE from 'three';

export type V2 = [number, number];

export class Polyline2 {
  pts: V2[];
  cum: number[];
  length: number;
  constructor(pts: V2[]) {
    this.pts = pts;
    this.cum = [0];
    for (let i = 1; i < pts.length; i++) {
      const dx = pts[i][0] - pts[i - 1][0];
      const dy = pts[i][1] - pts[i - 1][1];
      this.cum.push(this.cum[i - 1] + Math.hypot(dx, dy));
    }
    this.length = this.cum[this.cum.length - 1];
  }
  at(s: number): V2 {
    const L = Math.min(Math.max(s, 0), this.length);
    let i = 1;
    while (i < this.pts.length - 1 && this.cum[i] < L) i++;
    const a = this.pts[i - 1];
    const b = this.pts[i];
    const seg = this.cum[i] - this.cum[i - 1];
    const t = seg > 0 ? (L - this.cum[i - 1]) / seg : 0;
    return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
  }
  /** arc length of the closest point on the polyline */
  project(p: V2): number {
    let best = Infinity;
    let bestS = 0;
    for (let i = 1; i < this.pts.length; i++) {
      const a = this.pts[i - 1];
      const b = this.pts[i];
      const dx = b[0] - a[0];
      const dy = b[1] - a[1];
      const l2 = dx * dx + dy * dy;
      const t = Math.min(1, Math.max(0, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / l2));
      const qx = a[0] + dx * t - p[0];
      const qy = a[1] + dy * t - p[1];
      const d = qx * qx + qy * qy;
      if (d < best - 1e-9) {
        best = d;
        bestS = this.cum[i - 1] + Math.sqrt(l2) * t;
      }
    }
    return bestS;
  }
}

const EXTRUDE = (depth: number, bevel: number): THREE.ExtrudeGeometryOptions => ({
  depth,
  bevelEnabled: true,
  bevelThickness: bevel,
  bevelSize: bevel,
  bevelSegments: 3,
  curveSegments: 1,
  steps: 1,
});

/**
 * Thick flat zigzag band (mitred joins) extruded with a bevel. Each vertex
 * carries its arc length `aS` along the path so the band can be revealed
 * progressively in the shader (head leading).
 */
export const buildArrowBand = (path: Polyline2, halfW: number, depth: number, bevel: number, taperStart = 1) => {
  const p = path.pts;
  const n = p.length;
  const normals: V2[] = [];
  for (let i = 1; i < n; i++) {
    const dx = p[i][0] - p[i - 1][0];
    const dy = p[i][1] - p[i - 1][1];
    const l = Math.hypot(dx, dy);
    normals.push([-dy / l, dx / l]);
  }
  const left: V2[] = [];
  const right: V2[] = [];
  for (let i = 0; i < n; i++) {
    let m: V2;
    if (i === 0) m = normals[0];
    else if (i === n - 1) m = normals[n - 2];
    else {
      const a = normals[i - 1];
      const b = normals[i];
      const sx = a[0] + b[0];
      const sy = a[1] + b[1];
      const sl = Math.hypot(sx, sy);
      const mx = sx / sl;
      const my = sy / sl;
      const k = 1 / Math.max(0.35, mx * b[0] + my * b[1]);
      m = [mx * k, my * k];
    }
    const w = i === 0 ? halfW * taperStart : halfW;
    left.push([p[i][0] + m[0] * w, p[i][1] + m[1] * w]);
    right.push([p[i][0] - m[0] * w, p[i][1] - m[1] * w]);
  }
  const shape = new THREE.Shape();
  shape.moveTo(right[0][0], right[0][1]);
  for (let i = 1; i < n; i++) shape.lineTo(right[i][0], right[i][1]);
  for (let i = n - 1; i >= 0; i--) shape.lineTo(left[i][0], left[i][1]);
  shape.closePath();
  const geo = new THREE.ExtrudeGeometry(shape, EXTRUDE(depth, bevel));
  geo.translate(0, 0, -depth / 2);
  const pos = geo.getAttribute('position');
  const s = new Float32Array(pos.count);
  for (let i = 0; i < pos.count; i++) s[i] = path.project([pos.getX(i), pos.getY(i)]);
  geo.setAttribute('aS', new THREE.BufferAttribute(s, 1));
  geo.computeVertexNormals();
  return geo;
};

/** Arrow head: base centred on the origin, tip pointing along +x. */
export const buildArrowHead = (halfW: number, len: number, depth: number, bevel: number) => {
  const shape = new THREE.Shape();
  shape.moveTo(-0.02, -halfW);
  shape.lineTo(len, 0);
  shape.lineTo(-0.02, halfW);
  shape.lineTo(-0.02, -halfW);
  const geo = new THREE.ExtrudeGeometry(shape, EXTRUDE(depth, bevel));
  geo.translate(0, 0, -depth / 2);
  geo.computeVertexNormals();
  return geo;
};
