import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

// Unit-sized particle geometries. Each is used by one InstancedMesh.

const clean = (g: THREE.BufferGeometry) => {
  // keep only what the particle shaders read, so geometries merge cleanly
  const out = new THREE.BufferGeometry();
  const ng = g.index ? g.toNonIndexed() : g;
  out.setAttribute("position", ng.getAttribute("position"));
  out.setAttribute("normal", ng.getAttribute("normal"));
  return out;
};

const sphere = (r: number, at: THREE.Vector3) => {
  const g = new THREE.SphereGeometry(r, 14, 10);
  g.translate(at.x, at.y, at.z);
  return clean(g);
};

const bond = (a: THREE.Vector3, b: THREE.Vector3, r = 0.2) => {
  const len = a.distanceTo(b);
  const g = new THREE.CylinderGeometry(r, r, len, 10, 1, true);
  const q = new THREE.Quaternion().setFromUnitVectors(
    new THREE.Vector3(0, 1, 0),
    b.clone().sub(a).normalize(),
  );
  g.applyQuaternion(q);
  const mid = a.clone().add(b).multiplyScalar(0.5);
  g.translate(mid.x, mid.y, mid.z);
  return clean(g);
};

const molecule = (atoms: [number, number, number, number][], bonds: [number, number][]) => {
  const parts: THREE.BufferGeometry[] = [];
  const P = atoms.map(([x, y, z]) => new THREE.Vector3(x, y, z));
  atoms.forEach(([, , , r], i) => parts.push(sphere(r, P[i])));
  bonds.forEach(([a, b]) => parts.push(bond(P[a], P[b])));
  const g = mergeGeometries(parts)!;
  g.computeBoundingSphere();
  // centre on the bounding sphere and normalise to radius 1
  const bs = g.boundingSphere!;
  g.translate(-bs.center.x, -bs.center.y, -bs.center.z);
  g.scale(1 / bs.radius, 1 / bs.radius, 1 / bs.radius);
  g.computeBoundingSphere();
  return g;
};

// 2 to 5 spheres joined by short sticks
export const moleculeGeometries = (): THREE.BufferGeometry[] => {
  const a = 0.62;
  return [
    molecule(
      [
        [-0.75, 0, 0, 0.6],
        [0.75, 0, 0, 0.5],
      ],
      [[0, 1]],
    ),
    molecule(
      [
        [0, 0, 0, 0.6],
        [1.15, 0.75, 0, 0.42],
        [-1.15, 0.75, 0, 0.42],
      ],
      [
        [0, 1],
        [0, 2],
      ],
    ),
    molecule(
      [
        [0, 0, 0, 0.55],
        [0, 1.25, 0, 0.42],
        [1.15, -0.45, 0.35, 0.42],
        [-0.8, -0.45, 0.95, 0.42],
      ],
      [
        [0, 1],
        [0, 2],
        [0, 3],
      ],
    ),
    molecule(
      [
        [-2.0, 0, 0, a * 0.75],
        [-1.0, 0.65, 0, a],
        [0, 0, 0, a * 0.85],
        [1.0, 0.65, 0, a],
        [2.0, 0, 0.2, a * 0.75],
      ],
      [
        [0, 1],
        [1, 2],
        [2, 3],
        [3, 4],
      ],
    ),
  ];
};

// rod (capsule) and round bacteria, unit bounding radius
export const rodGeometry = () => {
  const g = new THREE.CapsuleGeometry(0.34, 1.32, 8, 18);
  g.rotateZ(Math.PI / 2);
  const c = clean(g);
  c.scale(1, 1, 1);
  c.computeBoundingSphere();
  const r = c.boundingSphere!.radius;
  c.scale(1 / r, 1 / r, 1 / r);
  c.computeBoundingSphere();
  return c;
};

export const coccusGeometry = () => {
  const g = clean(new THREE.SphereGeometry(1, 24, 16));
  g.scale(1, 0.92, 0.96);
  g.computeBoundingSphere();
  return g;
};

// small spiky irritant: a core with cones along the icosahedron's vertices
export const spikeGeometry = () => {
  const parts: THREE.BufferGeometry[] = [clean(new THREE.IcosahedronGeometry(0.48, 1))];
  const ico = new THREE.IcosahedronGeometry(1, 0);
  const pos = ico.getAttribute("position");
  const seen = new Set<string>();
  for (let i = 0; i < pos.count; i++) {
    const v = new THREE.Vector3(pos.getX(i), pos.getY(i), pos.getZ(i)).normalize();
    const key = v.toArray().map((x) => x.toFixed(3)).join(",");
    if (seen.has(key)) continue;
    seen.add(key);
    const cone = new THREE.ConeGeometry(0.15, 0.62, 8, 1, true);
    cone.translate(0, 0.62 / 2 + 0.36, 0);
    cone.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), v));
    parts.push(clean(cone));
  }
  const g = mergeGeometries(parts)!;
  g.computeBoundingSphere();
  const r = g.boundingSphere!.radius;
  g.scale(1 / r, 1 / r, 1 / r);
  g.computeBoundingSphere();
  return g;
};

/** An InstancedMesh with per-instance colour + (alpha, emissive, seed). */
export class InstancedGroup {
  readonly mesh: THREE.InstancedMesh;
  readonly inst: THREE.InstancedBufferAttribute;
  private readonly m = new THREE.Matrix4();
  private readonly s = new THREE.Vector3();
  private readonly c = new THREE.Color();

  constructor(geo: THREE.BufferGeometry, mat: THREE.Material, readonly count: number) {
    const g = geo.clone();
    this.inst = new THREE.InstancedBufferAttribute(new Float32Array(count * 4), 4);
    this.inst.setUsage(THREE.DynamicDrawUsage);
    g.setAttribute("aInst", this.inst);
    this.mesh = new THREE.InstancedMesh(g, mat, count);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.frustumCulled = false;
    // Fixed bounding sphere: three.js would otherwise compute it once from the
    // instance positions of whatever frame a tab renders first and use it as a
    // depth-sort key -> draw order (and blending) would depend on render history.
    this.mesh.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e4);
    for (let i = 0; i < count; i++) {
      this.mesh.setColorAt(i, this.c.setRGB(1, 1, 1));
      this.hide(i);
    }
  }

  set(
    i: number,
    pos: THREE.Vector3,
    quat: THREE.Quaternion,
    scale: number,
    color: THREE.Color,
    alpha: number,
    emissive: number,
    seed: number,
  ) {
    if (scale <= 1e-5 || alpha <= 0.002) {
      this.hide(i);
      return;
    }
    this.m.compose(pos, quat, this.s.setScalar(scale));
    this.mesh.setMatrixAt(i, this.m);
    this.mesh.setColorAt(i, color);
    this.inst.setXYZW(i, alpha, emissive, seed, 0);
  }

  hide(i: number) {
    this.m.makeScale(0, 0, 0);
    this.mesh.setMatrixAt(i, this.m);
    this.inst.setXYZW(i, 0, 0, 0, 0);
  }

  commit() {
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
    this.inst.needsUpdate = true;
  }
}
