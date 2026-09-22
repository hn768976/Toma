import * as THREE from "three";

export type ProfilePoint = {
  /** Radius from the axis of revolution (+Y). Must be >= 0. */
  x: number;
  /** Position along the axis. */
  y: number;
  /**
   * Force a hard crease at this point even if the two adjacent segments are
   * nearly collinear. Used for the capsule's cap rim.
   */
  crease?: boolean;
};

/**
 * Surface of revolution about +Y with explicit control over which profile
 * vertices are smooth and which are creases.
 *
 * `THREE.LatheGeometry` averages normals across every profile vertex, which
 * rounds off the capsule's cap rim into a soft gradient. The rim is the detail
 * that separates a capsule from a rounded cylinder, so it needs a genuine
 * crease: the vertex is emitted twice with the two adjacent face normals.
 *
 * Material faces outward (+x side of the profile); order points from the
 * bottom of the profile to the top.
 */
export const revolve = (
  points: readonly ProfilePoint[],
  radialSegments: number,
  creaseAngleDeg = 35,
): THREE.BufferGeometry => {
  const n = points.length;
  if (n < 2) throw new Error("revolve() needs at least two profile points");

  // Outward normal of each profile segment, in (radius, axis) space.
  const segN: { x: number; y: number }[] = [];
  for (let i = 0; i < n - 1; i++) {
    const dx = points[i + 1].x - points[i].x;
    const dy = points[i + 1].y - points[i].y;
    const len = Math.hypot(dx, dy) || 1;
    segN.push({ x: dy / len, y: -dx / len });
  }

  // Rings, in order along the profile. `bridge` marks whether a ring is joined
  // to the next one by faces (false at a crease, where two rings coincide).
  type Ring = { x: number; y: number; nx: number; ny: number; bridge: boolean };
  const rings: Ring[] = [];
  const cosLimit = Math.cos((creaseAngleDeg * Math.PI) / 180);

  for (let i = 0; i < n; i++) {
    const p = points[i];
    const a = i > 0 ? segN[i - 1] : null;
    const b = i < n - 1 ? segN[i] : null;

    if (a && b) {
      const smooth = !p.crease && a.x * b.x + a.y * b.y >= cosLimit;
      if (smooth) {
        const mx = a.x + b.x;
        const my = a.y + b.y;
        const l = Math.hypot(mx, my) || 1;
        rings.push({ x: p.x, y: p.y, nx: mx / l, ny: my / l, bridge: true });
      } else {
        rings.push({ x: p.x, y: p.y, nx: a.x, ny: a.y, bridge: false });
        rings.push({ x: p.x, y: p.y, nx: b.x, ny: b.y, bridge: true });
      }
    } else if (b) {
      rings.push({ x: p.x, y: p.y, nx: b.x, ny: b.y, bridge: true });
    } else if (a) {
      rings.push({ x: p.x, y: p.y, nx: a.x, ny: a.y, bridge: false });
    }
  }
  rings[rings.length - 1].bridge = false;

  // Arc length along the profile drives V so textures and shader gradients are
  // evenly distributed; U is the revolution angle.
  const arc: number[] = [0];
  for (let i = 1; i < rings.length; i++) {
    const d = Math.hypot(rings[i].x - rings[i - 1].x, rings[i].y - rings[i - 1].y);
    arc.push(arc[i - 1] + d);
  }
  const total = arc[arc.length - 1] || 1;

  const cols = radialSegments + 1; // duplicate seam column so U runs 0..1
  const vCount = rings.length * cols;
  const position = new Float32Array(vCount * 3);
  const normal = new Float32Array(vCount * 3);
  const uv = new Float32Array(vCount * 2);

  for (let r = 0; r < rings.length; r++) {
    const ring = rings[r];
    for (let c = 0; c < cols; c++) {
      const t = c / radialSegments;
      const theta = t * Math.PI * 2;
      const cos = Math.cos(theta);
      const sin = Math.sin(theta);
      const i3 = (r * cols + c) * 3;
      position[i3] = ring.x * cos;
      position[i3 + 1] = ring.y;
      position[i3 + 2] = ring.x * sin;
      // At a pole the profile radius is 0; fall back to the axial component so
      // the normal stays unit length.
      const nx = ring.nx * cos;
      const nz = ring.nx * sin;
      const nl = Math.hypot(nx, ring.ny, nz) || 1;
      normal[i3] = nx / nl;
      normal[i3 + 1] = ring.ny / nl;
      normal[i3 + 2] = nz / nl;
      const i2 = (r * cols + c) * 2;
      uv[i2] = t;
      uv[i2 + 1] = arc[r] / total;
    }
  }

  const indices: number[] = [];
  for (let r = 0; r < rings.length - 1; r++) {
    if (!rings[r].bridge) continue;
    for (let c = 0; c < radialSegments; c++) {
      const a = r * cols + c;
      const b = a + 1;
      const d = (r + 1) * cols + c;
      const e = d + 1;
      // Skip degenerate triangles at the poles.
      if (rings[r].x > 1e-9) indices.push(a, d, b);
      if (rings[r + 1].x > 1e-9) indices.push(b, d, e);
    }
  }

  const geom = new THREE.BufferGeometry();
  geom.setAttribute("position", new THREE.BufferAttribute(position, 3));
  geom.setAttribute("normal", new THREE.BufferAttribute(normal, 3));
  geom.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
  geom.setIndex(indices);
  geom.computeBoundingSphere();
  geom.computeBoundingBox();
  return geom;
};

/** Sample a circular arc into profile points, inclusive of both ends. */
export const arcPoints = (
  cx: number,
  cy: number,
  radius: number,
  fromDeg: number,
  toDeg: number,
  steps: number,
): ProfilePoint[] => {
  const out: ProfilePoint[] = [];
  for (let i = 0; i <= steps; i++) {
    const a = ((fromDeg + ((toDeg - fromDeg) * i) / steps) * Math.PI) / 180;
    out.push({ x: cx + Math.cos(a) * radius, y: cy + Math.sin(a) * radius });
  }
  return out;
};
