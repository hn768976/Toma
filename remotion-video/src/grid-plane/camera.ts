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
 * Depth of a world point in camera space. `wy` defaults to the ground plane;
 * pass a smaller value for a point above it. Affine in (wx, wy, wz), which is
 * what lets the segment and polygon clippers below interpolate in world space.
 */
export const depthAt = (
  wx: number,
  wz: number,
  cam: Camera,
  wy: number = cam.height,
): number => {
  const px = wx - cam.panX;
  const pz = wz - cam.dolly;
  const rz = px * Math.sin(cam.yaw) + pz * Math.cos(cam.yaw);
  return wy * Math.sin(cam.pitch) + rz * Math.cos(cam.pitch);
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

/**
 * Padding around the 1920x1080 frame within which geometry is still drawn.
 * Wider than the reach of the bloom filters, so clipping to it cannot remove
 * glow that would have spilled back into frame.
 */
const CULL_PAD = 220;

const CLIP_X0 = -CULL_PAD;
const CLIP_X1 = 1920 + CULL_PAD;
const CLIP_Y0 = -CULL_PAD;
const CLIP_Y1 = 1080 + CULL_PAD;

/**
 * Liang-Barsky clip of a projected segment to the padded frame.
 *
 * Near-plane clipping alone is not enough: a line running under the camera
 * reaches the near plane at coordinates in the tens of thousands, and a segment
 * with one end out there is not rejected by a simple both-ends-outside test. A
 * few of those in a bloomed group stretch its bounding box enormously, and
 * because an SVG filter region is expressed relative to that box, the blur then
 * changes from frame to frame as the geometry shifts — visible as a flicker
 * across the whole image. Clipping to the frame keeps every coordinate sane.
 *
 * Depth is interpolated through its reciprocal, which is the quantity that is
 * affine in screen space, so the clipped endpoints carry true depths.
 */
const clipToFrame = (
  a: Projected,
  b: Projected,
): [Projected, Projected] | null => {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const p = [-dx, dx, -dy, dy];
  const q = [a.x - CLIP_X0, CLIP_X1 - a.x, a.y - CLIP_Y0, CLIP_Y1 - a.y];

  let t0 = 0;
  let t1 = 1;
  for (let i = 0; i < 4; i++) {
    if (p[i] === 0) {
      if (q[i] < 0) return null; // parallel to this edge and outside it
      continue;
    }
    const r = q[i] / p[i];
    if (p[i] < 0) {
      if (r > t1) return null;
      if (r > t0) t0 = r;
    } else {
      if (r < t0) return null;
      if (r < t1) t1 = r;
    }
  }
  if (t0 === 0 && t1 === 1) return [a, b];

  const at = (t: number): Projected => ({
    x: a.x + dx * t,
    y: a.y + dy * t,
    depth: 1 / ((1 - t) / a.depth + t / b.depth),
  });
  return [t0 > 0 ? at(t0) : a, t1 < 1 ? at(t1) : b];
};

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
  wy: number = cam.height,
): [Projected, Projected] | null => {
  const da = depthAt(ax, az, cam, wy);
  const db = depthAt(bx, bz, cam, wy);
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

  const pa = project(x0, z0, cam, wy);
  const pb = project(x1, z1, cam, wy);
  if (!pa || !pb) return null;
  return clipToFrame(pa, pb);
};

/** A world-space corner: x, y (down-positive), z. */
export type Corner3 = readonly [number, number, number];

/**
 * Sutherland-Hodgman clip of a convex polygon against the near plane, in world
 * space. Depth is affine in (wx, wy, wz), so clipping before projecting is
 * exact — and works for the vertical faces of a raised module, not just for
 * polygons lying flat on the ground.
 */
const clipPolygonNear = (corners: readonly Corner3[], cam: Camera): Corner3[] => {
  const clipped: Corner3[] = [];
  for (let i = 0; i < corners.length; i++) {
    const a = corners[i];
    const b = corners[(i + 1) % corners.length];
    const d0 = depthAt(a[0], a[2], cam, a[1]);
    const d1 = depthAt(b[0], b[2], cam, b[1]);
    if (d0 >= NEAR) clipped.push(a);
    if (d0 >= NEAR !== d1 >= NEAR) {
      const t = (NEAR - d0) / (d1 - d0);
      clipped.push([
        a[0] + (b[0] - a[0]) * t,
        a[1] + (b[1] - a[1]) * t,
        a[2] + (b[2] - a[2]) * t,
      ]);
    }
  }
  return clipped;
};

export type ProjectedPolygon = {
  points: string;
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
};

/** Project a convex world-space polygon to an SVG points string and bounds. */
export const projectPolygon3 = (
  corners: readonly Corner3[],
  cam: Camera,
): ProjectedPolygon | null => {
  const clipped = clipPolygonNear(corners, cam);
  if (clipped.length < 3) return null;

  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  const parts: string[] = [];
  for (const [wx, wy, wz] of clipped) {
    const p = project(wx, wz, cam, wy);
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

const lift = (
  corners: readonly (readonly [number, number])[],
  wy: number,
): Corner3[] => corners.map(([wx, wz]) => [wx, wy, wz] as Corner3);

/**
 * Project a convex polygon lying at one elevation. `wy` defaults to the ground
 * plane; pass a smaller value for the face of a raised module.
 */
export const projectPolygon = (
  corners: readonly (readonly [number, number])[],
  cam: Camera,
  wy: number = cam.height,
): ProjectedPolygon | null => projectPolygon3(lift(corners, wy), cam);

/**
 * Project a convex polygon straight to SVG path data. Solar cell detail runs to
 * thousands of small polygons per frame; emitting them as subpaths of one
 * <path> keeps the DOM flat, so this skips the intermediate points string.
 */
export const projectPolygonPath = (
  corners: readonly (readonly [number, number])[],
  cam: Camera,
  wy: number = cam.height,
): string | null => {
  const clipped = clipPolygonNear(lift(corners, wy), cam);
  if (clipped.length < 3) return null;

  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  let d = "";
  for (let i = 0; i < clipped.length; i++) {
    const [wx, cy, wz] = clipped[i];
    const p = project(wx, wz, cam, cy);
    if (!p) return null;
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
    d += `${i === 0 ? "M" : "L"}${p.x.toFixed(1)} ${p.y.toFixed(1)}`;
  }
  if (maxX < -CULL_PAD || minX > 1920 + CULL_PAD) return null;
  if (maxY < -CULL_PAD || minY > 1080 + CULL_PAD) return null;

  return d + "Z";
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
