import * as THREE from "three";

export type Key = { t: number; v: THREE.Vector3 };

/**
 * Time-keyed Catmull-Rom spline. Keys are (time, position) pairs; tangents
 * are computed from neighbouring keys and scaled by segment duration, so the
 * curve stays smooth even when keys are not evenly spaced in time.
 */
export class TimedSpline {
  constructor(private readonly keys: Key[]) {
    if (keys.length < 2) throw new Error("TimedSpline needs >= 2 keys");
  }

  private tangent(i: number): THREE.Vector3 {
    const k = this.keys;
    const prev = k[Math.max(0, i - 1)];
    const next = k[Math.min(k.length - 1, i + 1)];
    const dt = next.t - prev.t || 1;
    return next.v.clone().sub(prev.v).multiplyScalar(1 / dt);
  }

  at(t: number): THREE.Vector3 {
    const k = this.keys;
    if (t <= k[0].t) return k[0].v.clone();
    if (t >= k[k.length - 1].t) return k[k.length - 1].v.clone();
    let i = 0;
    while (i < k.length - 2 && t > k[i + 1].t) i++;
    const a = k[i];
    const b = k[i + 1];
    const h = b.t - a.t;
    const s = (t - a.t) / h;
    const s2 = s * s;
    const s3 = s2 * s;
    const h00 = 2 * s3 - 3 * s2 + 1;
    const h10 = s3 - 2 * s2 + s;
    const h01 = -2 * s3 + 3 * s2;
    const h11 = s3 - s2;
    const ma = this.tangent(i).multiplyScalar(h);
    const mb = this.tangent(i + 1).multiplyScalar(h);
    return a.v
      .clone()
      .multiplyScalar(h00)
      .add(ma.multiplyScalar(h10))
      .add(b.v.clone().multiplyScalar(h01))
      .add(mb.multiplyScalar(h11));
  }
}

export const smoothstep = (e0: number, e1: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
};

export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
