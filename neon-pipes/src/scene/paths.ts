import * as THREE from "three";

export type V2 = [number, number];

/**
 * Builds the closed outline polygon (in the XZ plane) of a stroked,
 * axis-aligned polyline: offset `d` on both sides with square end caps.
 */
export const strokeOutline = (pts: V2[], d: number): V2[] => {
  const n = pts.length;
  const dirs: V2[] = [];
  for (let i = 0; i < n - 1; i++) {
    const dx = pts[i + 1][0] - pts[i][0];
    const dz = pts[i + 1][1] - pts[i][1];
    const l = Math.hypot(dx, dz);
    dirs.push([dx / l, dz / l]);
  }
  // left normal of a direction (x,z) -> (-z, x)
  const left = (v: V2): V2 => [-v[1], v[0]];
  const sideOffsets = (sign: number): V2[] => {
    const out: V2[] = [];
    for (let i = 0; i < n; i++) {
      if (i === 0 || i === n - 1) {
        const dir = i === 0 ? dirs[0] : dirs[n - 2];
        const nl = left(dir);
        const capSign = i === 0 ? -1 : 1;
        out.push([
          pts[i][0] + sign * d * nl[0] + capSign * d * dir[0],
          pts[i][1] + sign * d * nl[1] + capSign * d * dir[1],
        ]);
      } else {
        const n1 = left(dirs[i - 1]);
        const n2 = left(dirs[i]);
        // 90 degree miter: corner + d*(n1+n2)
        out.push([
          pts[i][0] + sign * d * (n1[0] + n2[0]),
          pts[i][1] + sign * d * (n1[1] + n2[1]),
        ]);
      }
    }
    return out;
  };
  const l = sideOffsets(1);
  const r = sideOffsets(-1).reverse();
  return [...l, ...r];
};

/**
 * Converts a polygon / polyline in 3D into a smooth CurvePath with rounded
 * (quadratic-bezier filleted) corners.
 */
export const roundedPath = (
  points: THREE.Vector3[],
  radius: number,
  closed: boolean,
): THREE.CurvePath<THREE.Vector3> => {
  const path = new THREE.CurvePath<THREE.Vector3>();
  const n = points.length;
  const count = closed ? n : n;
  const corners: { a: THREE.Vector3; v: THREE.Vector3; b: THREE.Vector3 }[] =
    [];
  for (let i = 0; i < count; i++) {
    const v = points[i];
    const isEnd = !closed && (i === 0 || i === n - 1);
    if (isEnd) {
      corners.push({ a: v.clone(), v: v.clone(), b: v.clone() });
      continue;
    }
    const prev = points[(i - 1 + n) % n];
    const next = points[(i + 1) % n];
    const toPrev = prev.clone().sub(v);
    const toNext = next.clone().sub(v);
    const rr = Math.min(radius, toPrev.length() * 0.45, toNext.length() * 0.45);
    corners.push({
      a: v.clone().add(toPrev.normalize().multiplyScalar(rr)),
      v: v.clone(),
      b: v.clone().add(toNext.normalize().multiplyScalar(rr)),
    });
  }
  const segs = closed ? n : n - 1;
  for (let i = 0; i < segs; i++) {
    const c0 = corners[i];
    const c1 = corners[(i + 1) % n];
    if (i > 0 || closed) {
      // fillet at corner i (start of this segment)
      if (c0.a.distanceTo(c0.b) > 1e-5) {
        path.add(new THREE.QuadraticBezierCurve3(c0.a, c0.v, c0.b));
      }
    }
    if (c0.b.distanceTo(c1.a) > 1e-5) {
      path.add(new THREE.LineCurve3(c0.b, c1.a));
    }
  }
  return path;
};
