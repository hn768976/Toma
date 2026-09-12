// Perspective camera for the tilted map plane.
//
// The baked geodata lives in flat "map space" (d3 Mercator pixels, y pointing
// south). This module lifts that plane into 3D and projects it back to the
// screen, which is what gives the composition its receding ground-plane look.
//
// Deriving the projection ourselves — rather than leaning on a CSS 3D
// transform — means every element (dots, arcs, city beams) shares one
// coordinate system, so screen-space furniture like the vertical light shafts
// can be placed exactly on top of their projected map position.

export type Camera = {
  /** Elevation of the camera above the plane, radians. PI/2 is straight down. */
  pitch: number;
  /** Rotation of the map underneath the camera, radians. */
  yaw: number;
  /** Screen-space roll, radians. Positive tips the horizon down to the right. */
  roll: number;
  /** Distance from the camera to the look-at point, in map units. */
  dist: number;
  /** Focal length in pixels. */
  focal: number;
  /** Map-space point the camera is centred on. */
  targetX: number;
  targetY: number;
  /** Screen-space position of that look-at point. */
  centerX: number;
  centerY: number;
};

export type Projected = {
  x: number;
  y: number;
  /** View-space depth, in map units. Larger is further away. */
  depth: number;
  /** Local map-units-to-pixels scale at this depth. */
  scale: number;
};

export type Project = (mx: number, my: number, out: Projected) => boolean;

/**
 * Builds a projector for one camera pose.
 *
 * With the camera orbiting a point on the plane at elevation `pitch`, the view
 * transform collapses to a pleasantly cheap form:
 *
 *   depth = dist + wy * cos(pitch)
 *   viewX = wx
 *   viewY = wy * sin(pitch)
 *
 * where (wx, wy) is the yaw-rotated, target-relative map position.
 */
export const makeProjector = (cam: Camera): Project => {
  const cp = Math.cos(cam.pitch);
  const sp = Math.sin(cam.pitch);
  const cyaw = Math.cos(cam.yaw);
  const syaw = Math.sin(cam.yaw);
  const cr = Math.cos(cam.roll);
  const sr = Math.sin(cam.roll);

  return (mx, my, out) => {
    const ax = mx - cam.targetX;
    // Flip to a north-up world: map space grows southward.
    const ay = cam.targetY - my;

    const wx = ax * cyaw - ay * syaw;
    const wy = ax * syaw + ay * cyaw;

    const depth = cam.dist + wy * cp;
    // Behind the camera, or so close to the horizon it would smear to infinity.
    if (depth < cam.dist * 0.08) return false;

    const k = cam.focal / depth;
    const px = wx * k;
    const py = -wy * sp * k;

    out.x = cam.centerX + px * cr - py * sr;
    out.y = cam.centerY + px * sr + py * cr;
    out.depth = depth;
    out.scale = k;
    return true;
  };
};

/** Scratch target so hot loops can project without allocating. */
export const scratch = (): Projected => ({ x: 0, y: 0, depth: 0, scale: 0 });
