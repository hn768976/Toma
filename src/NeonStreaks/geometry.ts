import { config } from "./config";

/** A resolved camera for one frame. Pure function of the frame number. */
export type Camera = {
  x: number;
  y: number;
  z: number;
  /** Focal length in pixels, derived from frame width and horizontal FOV. */
  f: number;
  /** Principal point in pixels. cy is the horizon line. */
  cx: number;
  cy: number;
  sinRoll: number;
  cosRoll: number;
  /**
   * Because each streak bends at its own depth, the world-space lateral spread
   * and path top are per-depth quantities. These coefficients turn a depth into
   * one: multiply by the streak's bend depth. Keeping them as coefficients is
   * what makes the same streak parameters work at any resolution or aspect.
   */
  spreadCoef: number;
  topCoef: number;
  /** Bend depth of a mid-field streak — used for frame-wide sizing decisions. */
  refDepth: number;
  /** Path top for the reference depth. */
  topY: number;
};

/** World half-width that maps to the frame edge at this depth. */
export const spreadXAt = (cam: Camera, depth: number): number =>
  cam.spreadCoef * depth;

/** World height at which the path has cleared the top of the frame. */
export const topYAt = (cam: Camera, depth: number): number =>
  cam.y + cam.topCoef * depth;

const TAU = Math.PI * 2;

/**
 * All camera motion is a whole number of cycles across the loop, so
 * cam(0) === cam(DURATION_IN_FRAMES).
 */
export const makeCamera = (
  frame: number,
  durationInFrames: number,
  width: number,
  height: number,
): Camera => {
  const c = config.camera;
  const t = frame / durationInFrames; // turns
  const f = width / 2 / Math.tan(((c.fovXDeg * Math.PI) / 180) / 2);
  const cx = width / 2;
  const cy = height * c.horizonY;

  const camX = c.truckAmp * Math.sin(TAU * (t + c.truckPhase));
  const camY = c.eyeHeight + c.heightAmp * Math.sin(TAU * (2 * t + c.heightPhase));
  const roll = ((c.rollAmpDeg * Math.PI) / 180) * Math.sin(TAU * (t + c.rollPhase));

  // Solve screenY = -overshoot*height for y, so the climb always leaves the
  // frame regardless of aspect ratio; and the half-width that reaches the
  // frame edge. Both scale linearly with depth.
  const topCoef = (cy + config.bend.topOvershoot * height) / f;
  const spreadCoef = width / 2 / f;
  const refDepth = (config.bend.depth.near + config.bend.depth.far) / 2;

  const cam: Camera = {
    x: camX,
    y: camY,
    z: 0,
    f,
    cx,
    cy,
    sinRoll: Math.sin(roll),
    cosRoll: Math.cos(roll),
    spreadCoef,
    topCoef,
    refDepth,
    topY: camY + topCoef * refDepth,
  };
  return cam;
};

export type Projected = {
  sx: number;
  sy: number;
  /** Distance in front of the camera. <= NEAR means the point is behind us. */
  d: number;
};

export const NEAR = 0.35;

/** Pinhole projection plus roll about the frame centre. */
export const project = (
  cam: Camera,
  wx: number,
  wy: number,
  wz: number,
  out: Projected,
): Projected => {
  const px = wx - cam.x;
  const py = wy - cam.y;
  const d = cam.z - wz; // camera looks toward -z, so this is positive in front
  out.d = d;
  if (d <= NEAR) {
    out.sx = NaN;
    out.sy = NaN;
    return out;
  }
  const ix = (cam.f * px) / d;
  const iy = (-cam.f * py) / d;
  out.sx = cam.cx + ix * cam.cosRoll - iy * cam.sinRoll;
  out.sy = cam.cy + ix * cam.sinRoll + iy * cam.cosRoll;
  return out;
};

/**
 * The three-part path: floor run -> quarter bend -> wall climb.
 *
 * The run travels along the floor in direction (dirX, 0, dirZ) and arrives at
 * the contact point C, where it rolls through a quarter circle of `radius` and
 * leaves vertically. `yaw` tilts the run away from "straight at the camera":
 * a purely head-on run projects to a near-vertical screen line, which makes
 * the 90 degree corner collapse into a hairpin, so some lateral sweep is what
 * makes the bend legible.
 */
export type Path = {
  /** Floor contact point — where the bend begins. */
  cx: number;
  cz: number;
  dirX: number;
  dirZ: number;
  radius: number;
  topY: number;
  /** Arclength of each part. */
  runLen: number;
  bendLen: number;
  climbLen: number;
  total: number;
};

export const makePath = (
  cam: Camera,
  /** Lateral position of the bend, in [-1, 1] of the frame half-width. */
  xNorm: number,
  /** Depth at which this streak turns upward. */
  bendDepth: number,
  /** How much depth the floor run covers before the bend. */
  runDepth: number,
  radius: number,
  yaw: number,
): Path => {
  const cz = -bendDepth; // camera sits at z = 0 looking toward -z
  const dirX = Math.sin(yaw);
  const dirZ = Math.cos(yaw);
  // The yaw stretches the run so it still covers `runDepth` of depth while
  // also sweeping sideways.
  const runLen = runDepth / dirZ;
  const bendLen = (Math.PI / 2) * radius;
  const topY = topYAt(cam, bendDepth);
  const climbLen = topY - radius;
  return {
    cx: xNorm * spreadXAt(cam, bendDepth),
    cz,
    dirX,
    dirZ,
    radius,
    topY,
    runLen,
    bendLen,
    climbLen,
    total: runLen + bendLen + climbLen,
  };
};

export type WorldPoint = { x: number; y: number; z: number };

/**
 * Point at arclength `s` along the path. Clamped at both ends.
 * s in [0, runLen]                      -> along the floor
 * s in [runLen, runLen+bendLen]         -> the 90 degree corner
 * s beyond that                         -> straight up the wall
 */
export const pointAt = (path: Path, s: number, out: WorldPoint): WorldPoint => {
  const { radius, cx, cz, dirX, dirZ } = path;
  if (s <= path.runLen) {
    // s < 0 is allowed: the tail simply extends further back down the floor.
    const u = s - path.runLen; // negative, measured back from the contact point
    out.x = cx + dirX * u;
    out.y = 0;
    out.z = cz + dirZ * u;
    return out;
  }
  const sb = s - path.runLen;
  if (sb <= path.bendLen) {
    const theta = sb / radius; // 0 .. PI/2
    const u = radius * Math.sin(theta);
    out.x = cx + dirX * u;
    out.y = radius - radius * Math.cos(theta);
    out.z = cz + dirZ * u;
    return out;
  }
  // Straight up, from the point where the arc goes vertical.
  out.x = cx + dirX * radius;
  out.y = radius + (sb - path.bendLen);
  out.z = cz + dirZ * radius;
  return out;
};

/** The floor-contact point (start of the bend), for pool placement. */
export const contactPoint = (path: Path, out: WorldPoint): WorldPoint => {
  out.x = path.cx;
  out.y = 0;
  out.z = path.cz;
  return out;
};
