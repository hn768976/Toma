import * as THREE from "three";

/**
 * Flattened hexagon (wider than tall, flat top and bottom) with rounded
 * corners, in world units centred on the origin.
 */
export const BADGE_W = 3.6;
export const BADGE_H = 2.3;
const TOP_HALF = 1.0; // half-length of the flat top / bottom edge
export const CORNER = 0.24;

const baseVerts = (): THREE.Vector2[] => [
  new THREE.Vector2(-BADGE_W / 2, 0),
  new THREE.Vector2(-TOP_HALF, BADGE_H / 2),
  new THREE.Vector2(TOP_HALF, BADGE_H / 2),
  new THREE.Vector2(BADGE_W / 2, 0),
  new THREE.Vector2(TOP_HALF, -BADGE_H / 2),
  new THREE.Vector2(-TOP_HALF, -BADGE_H / 2),
];

/** Hexagon moved inward by `inset` (true parallel offset of each edge). */
const insetVerts = (inset: number): THREE.Vector2[] => {
  const v = baseVerts();
  const n = v.length;
  // Polygon is clockwise (y up): inward normal of edge a->b is (dy, -dx) normalised... compute via centroid test.
  const lines = v.map((a, i) => {
    const b = v[(i + 1) % n];
    const d = b.clone().sub(a).normalize();
    let nrm = new THREE.Vector2(-d.y, d.x);
    const mid = a.clone().add(b).multiplyScalar(0.5);
    if (nrm.dot(mid) > 0) nrm = nrm.negate(); // point toward the centre
    return { p: a.clone().addScaledVector(nrm, inset), d };
  });
  return v.map((_, i) => {
    const l1 = lines[(i + n - 1) % n];
    const l2 = lines[i];
    // Solve l1.p + t*l1.d = l2.p + s*l2.d
    const den = l1.d.x * l2.d.y - l1.d.y * l2.d.x;
    const t = ((l2.p.x - l1.p.x) * l2.d.y - (l2.p.y - l1.p.y) * l2.d.x) / den;
    return l1.p.clone().addScaledVector(l1.d, t);
  });
};

/** Closed polyline of the rounded hexagon (clockwise from the left corner, y up). */
export const roundedHexPoints = (inset = 0, radius = CORNER, perCorner = 24, perEdge = 24) => {
  const v = insetVerts(inset);
  const n = v.length;
  const pts: THREE.Vector2[] = [];
  for (let i = 0; i < n; i++) {
    const prev = v[(i + n - 1) % n];
    const cur = v[i];
    const next = v[(i + 1) % n];
    const a = cur.clone().add(prev.clone().sub(cur).normalize().multiplyScalar(radius));
    const b = cur.clone().add(next.clone().sub(cur).normalize().multiplyScalar(radius));
    for (let k = 0; k <= perCorner; k++) {
      const t = k / perCorner;
      // quadratic Bezier a -> cur -> b
      const x = (1 - t) * (1 - t) * a.x + 2 * (1 - t) * t * cur.x + t * t * b.x;
      const y = (1 - t) * (1 - t) * a.y + 2 * (1 - t) * t * cur.y + t * t * b.y;
      pts.push(new THREE.Vector2(x, y));
    }
    const nb = next.clone().add(cur.clone().sub(next).normalize().multiplyScalar(radius));
    for (let k = 1; k < perEdge; k++) pts.push(b.clone().lerp(nb, k / perEdge));
  }
  return pts;
};

/** Neon tube path: rounded hexagon as a closed curve made of lines + quadratic corners. */
export const neonCurve = (radius = CORNER) => {
  const v = insetVerts(0);
  const n = v.length;
  const path = new THREE.CurvePath<THREE.Vector3>();
  const v3 = (p: THREE.Vector2) => new THREE.Vector3(p.x, p.y, 0);
  const corners = v.map((cur, i) => {
    const prev = v[(i + n - 1) % n];
    const next = v[(i + 1) % n];
    return {
      a: cur.clone().add(prev.clone().sub(cur).normalize().multiplyScalar(radius)),
      c: cur,
      b: cur.clone().add(next.clone().sub(cur).normalize().multiplyScalar(radius)),
    };
  });
  for (let i = 0; i < n; i++) {
    const k = corners[i];
    path.add(new THREE.QuadraticBezierCurve3(v3(k.a), v3(k.c), v3(k.b)));
    path.add(new THREE.LineCurve3(v3(k.b), v3(corners[(i + 1) % n].a)));
  }
  return path;
};

/** Face geometry with UVs spanning the badge bounding box (u right, v up). */
export const faceGeometry = (inset = 0) => {
  const shape = new THREE.Shape(roundedHexPoints(inset));
  const g = new THREE.ShapeGeometry(shape, 1);
  const pos = g.attributes.position;
  const uv = g.attributes.uv;
  for (let i = 0; i < pos.count; i++) {
    uv.setXY(i, pos.getX(i) / BADGE_W + 0.5, pos.getY(i) / BADGE_H + 0.5);
  }
  uv.needsUpdate = true;
  return g;
};
