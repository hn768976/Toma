// Geometry helpers for sculpted (non-primitive) shapes.
import * as THREE from "three";

export type Section = { w: number; h: number; ox?: number; oy?: number };

export type LoftOptions = {
  zStart?: number;
  length: number;
  rows?: number;
  cols?: number;
  /** cross-section at normalised position t (0..1) along the loft */
  section: (t: number) => Section;
  /** superellipse exponents for the +Y half and the -Y half (2 = ellipse) */
  nTop?: number;
  nBottom?: number;
  /** dome length at the start/end (0 = open end) */
  capStart?: number;
  capEnd?: number;
  /** optional sculpting pass on every vertex (final coordinates) */
  deform?: (v: THREE.Vector3) => void;
};

const se = (c: number, n: number) => Math.sign(c) * Math.pow(Math.abs(c), 2 / n);

/** Superellipse cross-section point for angle theta. */
export const sectionPoint = (
  sec: Section,
  theta: number,
  nTop: number,
  nBottom: number,
  scale = 1,
) => {
  const c = Math.cos(theta);
  const s = Math.sin(theta);
  const n = s >= 0 ? nTop : nBottom;
  return new THREE.Vector2(
    (sec.ox ?? 0) + (sec.w / 2) * scale * se(c, n),
    (sec.oy ?? 0) + (sec.h / 2) * scale * se(s, n),
  );
};

/**
 * Loft along +Z through superellipse sections, with optional domed ends.
 * Dense, evenly tessellated grid - suitable for smooth sculpting.
 */
export const loft = (o: LoftOptions) => {
  const rows = o.rows ?? 48;
  const cols = o.cols ?? 48;
  const nTop = o.nTop ?? 2.6;
  const nBottom = o.nBottom ?? 2.6;
  const z0 = o.zStart ?? 0;
  const c0 = o.capStart ?? 0;
  const c1 = o.capEnd ?? 0;
  const L = o.length;
  const pos: number[] = [];
  const idx: number[] = [];
  const ringStart: number[] = [];
  // sample positions, denser near the ends
  const zs: number[] = [];
  for (let k = 0; k <= rows; k++) zs.push((L * (1 - Math.cos((Math.PI * k) / rows))) / 2);
  const capScale = (z: number) => {
    let s = 1;
    if (c0 > 0 && z < c0) s = Math.min(s, Math.sqrt(Math.max(0, 1 - ((c0 - z) / c0) ** 2)));
    if (c1 > 0 && z > L - c1) s = Math.min(s, Math.sqrt(Math.max(0, 1 - ((z - (L - c1)) / c1) ** 2)));
    return s;
  };
  const kFirst = c0 > 0 ? 1 : 0;
  const kLast = c1 > 0 ? rows - 1 : rows;
  for (let k = kFirst; k <= kLast; k++) {
    const z = zs[k];
    const sec = o.section(z / L);
    const s = capScale(z);
    ringStart.push(pos.length / 3);
    for (let j = 0; j < cols; j++) {
      const p = sectionPoint(sec, (2 * Math.PI * j) / cols, nTop, nBottom, s);
      pos.push(p.x, p.y, z0 + z);
    }
  }
  const R = ringStart.length;
  for (let r = 0; r < R - 1; r++) {
    for (let j = 0; j < cols; j++) {
      const a = ringStart[r] + j;
      const b = ringStart[r] + ((j + 1) % cols);
      const c = ringStart[r + 1] + j;
      const d = ringStart[r + 1] + ((j + 1) % cols);
      idx.push(a, b, c, b, d, c);
    }
  }
  if (c0 > 0) {
    const sec = o.section(0);
    const p = pos.length / 3;
    pos.push(sec.ox ?? 0, sec.oy ?? 0, z0);
    for (let j = 0; j < cols; j++) idx.push(p, ringStart[0] + ((j + 1) % cols), ringStart[0] + j);
  }
  if (c1 > 0) {
    const sec = o.section(1);
    const p = pos.length / 3;
    pos.push(sec.ox ?? 0, sec.oy ?? 0, z0 + L);
    const last = ringStart[R - 1];
    for (let j = 0; j < cols; j++) idx.push(last + j, last + ((j + 1) % cols), p);
  }
  if (o.deform) {
    const v = new THREE.Vector3();
    for (let i = 0; i < pos.length; i += 3) {
      v.set(pos[i], pos[i + 1], pos[i + 2]);
      o.deform(v);
      pos[i] = v.x;
      pos[i + 1] = v.y;
      pos[i + 2] = v.z;
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
};

/** Thin tube along a set of points (seam lines, cables, rods). */
export const tube = (
  pts: THREE.Vector3[],
  radius: number,
  mat: THREE.Material,
  closed = false,
  segs = 64,
) => {
  const curve = new THREE.CatmullRomCurve3(pts, closed, "centripetal");
  return new THREE.Mesh(new THREE.TubeGeometry(curve, segs, radius, 8, closed), mat);
};

/** Straight cylinder between two points. */
export const rod = (a: THREE.Vector3, b: THREE.Vector3, r: number, mat: THREE.Material, segs = 24) => {
  const len = a.distanceTo(b);
  const g = new THREE.CylinderGeometry(r, r, len, segs);
  const m = new THREE.Mesh(g, mat);
  m.position.copy(a).add(b).multiplyScalar(0.5);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
  return m;
};
