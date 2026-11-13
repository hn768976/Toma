import * as THREE from "three";

export type PathFrame = {
  p: THREE.Vector3;
  t: THREE.Vector3;
  n: THREE.Vector3;
  b: THREE.Vector3;
};

/**
 * Centre line of the vessel. The curve is defined by its curvature and
 * integrated with a rotation-minimising (Bishop) frame, so the tube built
 * around it never twists.
 *
 * At s = 0 the frame is: tangent = -Z, normal = +X, binormal = +Y, which is
 * exactly the default orientation of a Three.js camera.
 */
export class VesselPath {
  readonly length: number;
  readonly ds: number;
  private count: number;
  private data: Float32Array; // p(3) t(3) n(3) b(3) per sample

  constructor(
    curvature: (s: number) => [number, number],
    length: number,
    ds = 0.04,
  ) {
    this.length = length;
    this.ds = ds;
    this.count = Math.ceil(length / ds) + 2;
    this.data = new Float32Array(this.count * 12);

    const p = new THREE.Vector3(0, 0, 0);
    const t = new THREE.Vector3(0, 0, -1);
    const n = new THREE.Vector3(1, 0, 0);
    const b = new THREE.Vector3(0, 1, 0);
    const dt = new THREE.Vector3();

    for (let i = 0; i < this.count; i++) {
      this.data.set([p.x, p.y, p.z, t.x, t.y, t.z, n.x, n.y, n.z, b.x, b.y, b.z], i * 12);
      const [kn, kb] = curvature(i * ds);
      p.addScaledVector(t, ds);
      dt.set(0, 0, 0).addScaledVector(n, kn * ds).addScaledVector(b, kb * ds);
      const tn = t.clone().add(dt).normalize();
      // Transport the frame: remove the new tangent component and renormalise.
      n.addScaledVector(tn, -n.dot(tn)).normalize();
      // n x t keeps the handedness of the initial frame (X x -Z = +Y).
      b.crossVectors(n, tn).normalize();
      t.copy(tn);
    }
  }

  sample(s: number, out?: PathFrame): PathFrame {
    const f: PathFrame = out ?? {
      p: new THREE.Vector3(),
      t: new THREE.Vector3(),
      n: new THREE.Vector3(),
      b: new THREE.Vector3(),
    };
    const x = Math.min(Math.max(s / this.ds, 0), this.count - 1.0001);
    const i = Math.floor(x);
    const u = x - i;
    const d = this.data;
    const o = i * 12;
    const L = (k: number) => d[o + k] * (1 - u) + d[o + 12 + k] * u;
    f.p.set(L(0), L(1), L(2));
    f.t.set(L(3), L(4), L(5)).normalize();
    f.n.set(L(6), L(7), L(8)).normalize();
    f.b.set(L(9), L(10), L(11)).normalize();
    return f;
  }
}
