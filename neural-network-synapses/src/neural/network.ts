import * as THREE from "three";
import { makeRng, randomUnit, range, Rng } from "./rng";

/** Centre line of one dendrite, used to drive the travelling impulses. */
export type BranchPath = { pts: Float32Array; count: number; length: number; depth: number };

export type Neuron = {
  center: THREE.Vector3;
  radius: number;
  geometry: THREE.BufferGeometry;
  somaGeometry: THREE.BufferGeometry;
  paths: BranchPath[];
  hero: boolean;
};

/** Pushes a growth direction away from a keep-out zone (the camera corridor). */
export type Steer = (worldPoint: THREE.Vector3, dir: THREE.Vector3) => void;

type Detail = { maxDepth: number; step: number; radial: number; primaries: number };

const DETAIL: Detail[] = [
  { maxDepth: 3, step: 0.4, radial: 12, primaries: 8 }, // hero / near the lens
  { maxDepth: 3, step: 0.65, radial: 8, primaries: 7 },
  { maxDepth: 2, step: 1.0, radial: 5, primaries: 6 },
];

const tmpA = new THREE.Vector3();
const tmpB = new THREE.Vector3();

class TubeBuilder {
  positions: number[] = [];
  normals: number[] = [];
  radii: number[] = [];
  indices: number[] = [];

  /** Sweep a ring along the polyline using parallel-transport frames. */
  add(pts: THREE.Vector3[], radii: number[], radial: number) {
    const n = pts.length;
    if (n < 2) return;
    const base = this.positions.length / 3;
    const tangent = new THREE.Vector3();
    const normal = new THREE.Vector3();
    const binormal = new THREE.Vector3();
    const prevT = new THREE.Vector3();
    for (let i = 0; i < n; i++) {
      const a = pts[Math.max(0, i - 1)];
      const b = pts[Math.min(n - 1, i + 1)];
      tangent.subVectors(b, a).normalize();
      if (i === 0) {
        tmpA.set(0, 1, 0);
        if (Math.abs(tangent.y) > 0.9) tmpA.set(1, 0, 0);
        normal.crossVectors(tangent, tmpA).normalize();
      } else {
        tmpA.crossVectors(prevT, tangent);
        const s = tmpA.length();
        if (s > 1e-6) {
          tmpA.multiplyScalar(1 / s);
          normal.applyAxisAngle(tmpA, Math.asin(Math.min(1, s)));
        }
        // Re-orthogonalise against drift.
        normal.addScaledVector(tangent, -normal.dot(tangent)).normalize();
      }
      prevT.copy(tangent);
      binormal.crossVectors(tangent, normal);
      const p = pts[i];
      const r = radii[i];
      for (let k = 0; k < radial; k++) {
        const ang = (k / radial) * Math.PI * 2;
        const c = Math.cos(ang);
        const s = Math.sin(ang);
        const nx = normal.x * c + binormal.x * s;
        const ny = normal.y * c + binormal.y * s;
        const nz = normal.z * c + binormal.z * s;
        this.positions.push(p.x + nx * r, p.y + ny * r, p.z + nz * r);
        this.normals.push(nx, ny, nz);
        this.radii.push(r);
      }
    }
    for (let i = 0; i < n - 1; i++) {
      for (let k = 0; k < radial; k++) {
        const a = base + i * radial + k;
        const b = base + i * radial + ((k + 1) % radial);
        const c = a + radial;
        const d = b + radial;
        this.indices.push(a, c, b, b, c, d);
      }
    }
  }

  build() {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(this.positions, 3));
    g.setAttribute("normal", new THREE.Float32BufferAttribute(this.normals, 3));
    g.setAttribute("aRadius", new THREE.Float32BufferAttribute(this.radii, 1));
    g.setIndex(new THREE.Uint32BufferAttribute(this.indices, 1));
    g.computeBoundingSphere();
    return g;
  }
}

function grow(
  rng: Rng,
  tubes: TubeBuilder,
  paths: BranchPath[],
  start: THREE.Vector3,
  dir: THREE.Vector3,
  length: number,
  r0: number,
  depth: number,
  detail: Detail,
  primary: boolean,
  origin: THREE.Vector3,
  steer: Steer,
) {
  const n = Math.max(4, Math.ceil(length / detail.step));
  const pts: THREE.Vector3[] = [];
  const radii: number[] = [];
  const d = dir.clone().normalize();
  const drift = new THREE.Vector3();
  const p = start.clone();
  const ph1 = rng() * 20;
  const ph2 = rng() * 20;
  // A few swollen varicosities per branch give the lumpy, organic silhouette.
  const bulbs: number[] = [];
  const bulbCount = Math.floor(range(rng, 0, 3.99));
  for (let i = 0; i < bulbCount; i++) bulbs.push(range(rng, 0.1, 0.95) * length);
  const stepLen = length / (n - 1);
  const tipR = Math.max(0.034, r0 * 0.3);
  for (let i = 0; i < n; i++) {
    const u = i / (n - 1);
    const s = u * length;
    let r: number;
    if (primary) {
      // Flared root that melts into the soma, then a slow taper.
      r = r0 * (0.36 + 0.64 * Math.exp(-s / 1.2)) * (1 - 0.5 * u);
    } else {
      r = r0 * (1 - 0.6 * u);
    }
    r = Math.max(r, tipR * (1 - 0.5 * u));
    r *= 1 + 0.2 * Math.sin(s * 2.3 + ph1) * Math.sin(s * 0.9 + ph2);
    for (const b of bulbs) {
      const q = (s - b) / 0.32;
      r *= 1 + 0.55 * Math.exp(-q * q);
    }
    pts.push(p.clone());
    radii.push(r);
    randomUnit(rng, tmpA);
    drift.multiplyScalar(0.9).addScaledVector(tmpA, 0.06 * (detail.step / 0.5));
    d.add(tmpB.copy(drift).multiplyScalar(stepLen / detail.step)).normalize();
    steer(tmpB.copy(p).add(origin), d);
    p.addScaledVector(d, stepLen);
  }
  tubes.add(pts, radii, r0 > 0.07 ? detail.radial : Math.max(4, detail.radial - 2));

  const flat = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    flat[i * 3] = pts[i].x;
    flat[i * 3 + 1] = pts[i].y;
    flat[i * 3 + 2] = pts[i].z;
  }
  paths.push({ pts: flat, count: n, length, depth });

  if (depth >= detail.maxDepth) return;
  const children =
    depth === 0
      ? Math.round(range(rng, 2.5, 4.4))
      : depth === 1
        ? Math.round(range(rng, 1.5, 3))
        : Math.round(range(rng, 0.6, 2));
  for (let c = 0; c < children; c++) {
    const u = range(rng, primary ? 0.1 : 0.15, 0.85);
    const idx = Math.min(n - 2, Math.floor(u * (n - 1)));
    const here = pts[idx];
    const along = tmpA.subVectors(pts[idx + 1], here).normalize().clone();
    // Fork off at 25-65 degrees around a random perpendicular axis.
    randomUnit(rng, tmpB);
    const axis = tmpB.clone().cross(along).normalize();
    const childDir = along.clone().applyAxisAngle(axis, range(rng, 0.45, 1.15));
    grow(
      rng,
      tubes,
      paths,
      here,
      childDir,
      length * range(rng, 0.42, 0.72),
      Math.max(0.048, radii[idx] * 0.8),
      depth + 1,
      detail,
      false,
      origin,
      steer,
    );
  }
}

function buildSoma(rng: Rng, radius: number, dirs: THREE.Vector3[], segments: number) {
  const g = new THREE.SphereGeometry(1, segments, Math.round(segments * 0.66));
  const pos = g.getAttribute("position") as THREE.BufferAttribute;
  const nor = g.getAttribute("normal") as THREE.BufferAttribute;
  const ph = [rng() * 9, rng() * 9, rng() * 9];
  const shape = (v: THREE.Vector3) => {
    let f = 1;
    f += 0.035 * Math.sin(v.x * 3.1 + ph[0]) * Math.sin(v.y * 2.7 + ph[1]);
    f += 0.02 * Math.sin(v.z * 5.3 + ph[2]) * Math.sin(v.x * 4.1 + ph[1]);
    // Bulge towards each dendrite root so the tubes grow out of the membrane.
    for (const d of dirs) {
      const k = Math.max(0, v.dot(d));
      f += 0.07 * Math.pow(k, 22);
    }
    return f * radius;
  };
  const n = new THREE.Vector3();
  const t1 = new THREE.Vector3();
  const t2 = new THREE.Vector3();
  const p0 = new THREE.Vector3();
  const p1 = new THREE.Vector3();
  const p2 = new THREE.Vector3();
  const e = 0.02;
  for (let i = 0; i < pos.count; i++) {
    n.fromBufferAttribute(pos, i).normalize();
    t1.set(0, 1, 0);
    if (Math.abs(n.y) > 0.9) t1.set(1, 0, 0);
    t1.cross(n).normalize();
    t2.crossVectors(n, t1);
    p0.copy(n).multiplyScalar(shape(n));
    p1.copy(n).addScaledVector(t1, e).normalize();
    p1.multiplyScalar(shape(p1));
    p2.copy(n).addScaledVector(t2, e).normalize();
    p2.multiplyScalar(shape(p2));
    p1.sub(p0);
    p2.sub(p0);
    p1.cross(p2).normalize();
    pos.setXYZ(i, p0.x, p0.y, p0.z);
    nor.setXYZ(i, p1.x, p1.y, p1.z);
  }
  g.deleteAttribute("uv");
  g.setAttribute("aRadius", new THREE.Float32BufferAttribute(new Float32Array(pos.count).fill(radius), 1));
  g.computeBoundingSphere();
  return g;
}

export function buildNeuron(
  seed: number,
  center: THREE.Vector3,
  radius: number,
  detailLevel: number,
  hero: boolean,
  steer: Steer,
): Neuron {
  const rng = makeRng(seed);
  const detail = DETAIL[detailLevel];
  const tubes = new TubeBuilder();
  const paths: BranchPath[] = [];
  const dirs: THREE.Vector3[] = [];
  // Spread the primary dendrites over the sphere (best-candidate sampling).
  for (let i = 0; i < detail.primaries; i++) {
    let best = new THREE.Vector3();
    let bestScore = -Infinity;
    for (let c = 0; c < 12; c++) {
      const cand = randomUnit(rng, new THREE.Vector3()) as THREE.Vector3;
      let minD = 4;
      for (const o of dirs) minD = Math.min(minD, cand.distanceToSquared(o));
      if (minD > bestScore) {
        bestScore = minD;
        best = cand;
      }
    }
    dirs.push(best);
  }
  for (const d of dirs) {
    grow(
      rng,
      tubes,
      paths,
      d.clone().multiplyScalar(radius * 0.8),
      d,
      range(rng, 15, 30) * radius,
      range(rng, 0.23, 0.31) * radius,
      0,
      detail,
      true,
      center,
      steer,
    );
  }
  return {
    center,
    radius,
    geometry: tubes.build(),
    somaGeometry: buildSoma(rng, radius, dirs, hero ? 72 : detailLevel === 2 ? 20 : 36),
    paths,
    hero,
  };
}
