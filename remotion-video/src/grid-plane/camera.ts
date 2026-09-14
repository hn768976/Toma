// Pinhole camera over an infinite ground plane, used by both grid-plane videos.
//
// World axes are y-down: the camera sits at the origin looking along +z and the
// ground plane lies at y = camera.height. Everything is expressed in world
// units and projected into the 1920x1080 design viewBox, so the exact same
// numbers produce the exact same framing at 1080p and at 4K.

export type Camera = {
  /** Focal length, in design-space pixels. */
  focal: number;
  /** Distance from the camera down to the ground plane. */
  height: number;
  /** Downward tilt, radians. Larger looks more straight down. */
  pitch: number;
  /** Rotation of the plane about the vertical axis, radians. */
  yaw: number;
  /** Screen-space roll applied after projection, radians. */
  roll: number;
  /** Camera position along world x (lateral drift). */
  panX: number;
  /** Camera position along world z (forward dolly). */
  dolly: number;
  /** Principal point. */
  cx: number;
  cy: number;
};

export type Projected = { x: number; y: number; depth: number };

/** Anything closer than this is behind/too near the lens and must be clipped. */
export const NEAR = 0.4;

/**
 * Depth of a ground point in camera space. Affine in (wx, wz), which is what
 * lets the segment and polygon clippers below interpolate in world space.
 */
export const depthAt = (wx: number, wz: number, cam: Camera): number => {
  const px = wx - cam.panX;
  const pz = wz - cam.dolly;
  const rz = px * Math.sin(cam.yaw) + pz * Math.cos(cam.yaw);
  return cam.height * Math.sin(cam.pitch) + rz * Math.cos(cam.pitch);
};

/**
 * Project a world point. `wy` defaults to the ground plane; pass a smaller
 * value to float a point above it (dust, flares).
 */
export const project = (
  wx: number,
  wz: number,
  cam: Camera,
  wy: number = cam.height,
): Projected | null => {
  const px = wx - cam.panX;
  const pz = wz - cam.dolly;

  const cyaw = Math.cos(cam.yaw);
  const syaw = Math.sin(cam.yaw);
  const rx = px * cyaw - pz * syaw;
  const rz = px * syaw + pz * cyaw;

  const cp = Math.cos(cam.pitch);
  const sp = Math.sin(cam.pitch);
  const y1 = wy * cp - rz * sp;
  const z1 = wy * sp + rz * cp;
  if (z1 < NEAR) return null;

  const sx = (cam.focal * rx) / z1;
  const sy = (cam.focal * y1) / z1;

  const cr = Math.cos(cam.roll);
  const sr = Math.sin(cam.roll);
  return {
    x: cam.cx + sx * cr - sy * sr,
    y: cam.cy + sx * sr + sy * cr,
    depth: z1,
  };
};

/** Padding around the 1920x1080 frame within which geometry is still drawn. */
const CULL_PAD = 220;

export const offScreen = (a: Projected, b: Projected): boolean =>
  (a.x < -CULL_PAD && b.x < -CULL_PAD) ||
  (a.x > 1920 + CULL_PAD && b.x > 1920 + CULL_PAD) ||
  (a.y < -CULL_PAD && b.y < -CULL_PAD) ||
  (a.y > 1080 + CULL_PAD && b.y > 1080 + CULL_PAD);

/**
 * Project a ground-plane segment, clipping it against the near plane first so
 * that segments running under the camera don't wrap around the horizon.
 */
export const projectSegment = (
  ax: number,
  az: number,
  bx: number,
  bz: number,
  cam: Camera,
): [Projected, Projected] | null => {
  const da = depthAt(ax, az, cam);
  const db = depthAt(bx, bz, cam);
  if (da < NEAR && db < NEAR) return null;

  let x0 = ax;
  let z0 = az;
  let x1 = bx;
  let z1 = bz;

  if (da < NEAR) {
    const t = (NEAR - da) / (db - da);
    x0 = ax + (bx - ax) * t;
    z0 = az + (bz - az) * t;
  } else if (db < NEAR) {
    const t = (NEAR - db) / (da - db);
    x1 = bx + (ax - bx) * t;
    z1 = bz + (az - bz) * t;
  }

  const pa = project(x0, z0, cam);
  const pb = project(x1, z1, cam);
  if (!pa || !pb || offScreen(pa, pb)) return null;
  return [pa, pb];
};

/**
 * Project a convex ground-plane polygon, Sutherland-Hodgman clipped against
 * the near plane. Returns an SVG points string, or null when fully culled.
 */
export const projectPolygon = (
  corners: readonly (readonly [number, number])[],
  cam: Camera,
): { points: string; minX: number; maxX: number; minY: number; maxY: number } | null => {
  const clipped: [number, number][] = [];
  for (let i = 0; i < corners.length; i++) {
    const [cx0, cz0] = corners[i];
    const [cx1, cz1] = corners[(i + 1) % corners.length];
    const d0 = depthAt(cx0, cz0, cam);
    const d1 = depthAt(cx1, cz1, cam);
    if (d0 >= NEAR) clipped.push([cx0, cz0]);
    if (d0 >= NEAR !== d1 >= NEAR) {
      const t = (NEAR - d0) / (d1 - d0);
      clipped.push([cx0 + (cx1 - cx0) * t, cz0 + (cz1 - cz0) * t]);
    }
  }
  if (clipped.length < 3) return null;

  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  const parts: string[] = [];
  for (const [wx, wz] of clipped) {
    const p = project(wx, wz, cam);
    if (!p) return null;
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
    parts.push(`${p.x.toFixed(2)},${p.y.toFixed(2)}`);
  }
  if (maxX < -CULL_PAD || minX > 1920 + CULL_PAD) return null;
  if (maxY < -CULL_PAD || minY > 1080 + CULL_PAD) return null;

  return { points: parts.join(" "), minX, maxX, minY, maxY };
};

/**
 * Portion of a ground segment whose camera depth lies inside [minDepth,
 * maxDepth], as a parameter interval. Depth is affine along the segment, so
 * that portion is always a single interval and can be solved for exactly —
 * sampling the segment at a few points instead drops whole stretches of long
 * lines that run from under the camera out to the horizon.
 */
export const depthBand = (
  ax: number,
  az: number,
  bx: number,
  bz: number,
  cam: Camera,
  minDepth: number,
  maxDepth: number,
): [number, number] | null => {
  const d0 = depthAt(ax, az, cam);
  const d1 = depthAt(bx, bz, cam);
  const dd = d1 - d0;

  if (Math.abs(dd) < 1e-9) {
    return d0 < minDepth || d0 > maxDepth ? null : [0, 1];
  }

  const ta = (minDepth - d0) / dd;
  const tb = (maxDepth - d0) / dd;
  const t0 = Math.max(0, Math.min(ta, tb));
  const t1 = Math.min(1, Math.max(ta, tb));
  return t1 <= t0 ? null : [t0, t1];
};
