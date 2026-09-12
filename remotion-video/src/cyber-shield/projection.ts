// A minimal perspective camera used to place the emblem in 3D.
//
// The emblem (rings + shield) is a flat plate living at z = 0 in its own
// local space. Rather than leaning on CSS 3D transforms — which rasterise
// their subtree at the pre-transform size and go soft when the
// composition is upscaled to 4K — every point is projected here and
// emitted as plain SVG geometry, so the output stays true vector at any
// resolution and gets correct keystoning for free.

/** Camera distance from the emblem plane, in design units. */
export const CAMERA_DEPTH = 2400;

export type Pose = {
  /** Rotation about the vertical axis, radians. */
  yaw: number;
  /** Rotation about the horizontal axis, radians. */
  pitch: number;
  /** In-plane rotation, radians. */
  roll: number;
  centerX: number;
  centerY: number;
  scale: number;
};

export type Projected = {
  x: number;
  y: number;
  /** Depth after rotation; > 0 is nearer the camera. */
  z: number;
  /** Perspective factor — multiply local sizes by this. */
  f: number;
};

export const degToRad = (deg: number) => (deg * Math.PI) / 180;

export const project = (x: number, y: number, pose: Pose): Projected => {
  // Roll first, so it reads as a rotation of the plate in its own plane.
  const cr = Math.cos(pose.roll);
  const sr = Math.sin(pose.roll);
  let px = x * cr - y * sr;
  let py = x * sr + y * cr;
  let pz = 0;

  // Yaw about Y.
  const cy = Math.cos(pose.yaw);
  const sy = Math.sin(pose.yaw);
  const nx = px * cy + pz * sy;
  pz = -px * sy + pz * cy;
  px = nx;

  // Pitch about X.
  const cp = Math.cos(pose.pitch);
  const sp = Math.sin(pose.pitch);
  const ny = py * cp - pz * sp;
  pz = py * sp + pz * cp;
  py = ny;

  const f = (CAMERA_DEPTH / (CAMERA_DEPTH - pz)) * pose.scale;
  return {
    x: pose.centerX + px * f,
    y: pose.centerY + py * f,
    z: pz,
    f,
  };
};

export type Point = [number, number];

export const projectPoints = (points: Point[], pose: Pose): Projected[] =>
  points.map(([x, y]) => project(x, y, pose));

/** Builds an SVG path from already-projected points. */
export const toPath = (points: Projected[], close = true): string => {
  if (points.length === 0) return "";
  let d = `M ${points[0].x.toFixed(2)} ${points[0].y.toFixed(2)}`;
  for (let i = 1; i < points.length; i++) {
    d += ` L ${points[i].x.toFixed(2)} ${points[i].y.toFixed(2)}`;
  }
  return close ? `${d} Z` : d;
};

export const pathFor = (points: Point[], pose: Pose, close = true): string =>
  toPath(projectPoints(points, pose), close);

/** Samples a circle (or arc) in local space, ready for projection. */
export const arcPoints = (
  radius: number,
  startDeg: number,
  endDeg: number,
  steps: number,
): Point[] => {
  const out: Point[] = [];
  for (let i = 0; i <= steps; i++) {
    const a = degToRad(startDeg + ((endDeg - startDeg) * i) / steps);
    out.push([Math.cos(a) * radius, Math.sin(a) * radius]);
  }
  return out;
};

export const circlePoints = (radius: number, steps = 96): Point[] =>
  arcPoints(radius, 0, 360, steps);

/** Cubic Bezier sampling, used to turn the shield outline into points. */
export const sampleCubic = (
  p0: Point,
  p1: Point,
  p2: Point,
  p3: Point,
  steps: number,
): Point[] => {
  const out: Point[] = [];
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    const u = 1 - t;
    const a = u * u * u;
    const b = 3 * u * u * t;
    const c = 3 * u * t * t;
    const d = t * t * t;
    out.push([
      a * p0[0] + b * p1[0] + c * p2[0] + d * p3[0],
      a * p0[1] + b * p1[1] + c * p2[1] + d * p3[1],
    ]);
  }
  return out;
};
