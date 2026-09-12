// A real 3D pinhole camera looking at the map plane.
//
// This is deliberately a projective transform and not a CSS skew or a
// vertical squash: every dot, grid line, candle body and ticker anchor goes
// through the same matrix, so they all share one vanishing point and one
// depth scale. That is what makes the plane read as
// a plane rather than as a flat image that has been distorted - and it means
// dot spacing tightens towards the horizon on its own, because the spacing
// is computed in map space and projected, never faked in screen space.

import {
  CAMERA_DISTANCE,
  DOLLY_AMP,
  DOLLY_PERIOD,
  MAP_WORLD_WIDTH,
  PAN_PERIOD,
  PAN_X_AMP,
  PAN_Y_AMP,
  PITCH_AMP_DEG,
  PITCH_BASE_DEG,
  PITCH_PERIOD,
  ROLL_AMP_DEG,
  ROLL_PERIOD,
  YAW_AMP_DEG,
  YAW_BASE_DEG,
  YAW_PERIOD,
  type MapGeometry,
} from "./constants";
import { WORLD_LAT_MAX, WORLD_LAT_MIN } from "./world-dots";

const DEG = Math.PI / 180;
const TAU = Math.PI * 2;

// Degrees of longitude per world unit. Latitude uses the same divisor,
// which is what keeps the lattice square (an equirectangular map: 360
// degrees of longitude across MAP_WORLD_WIDTH units, 180 of latitude
// across half that).
const DEG_PER_UNIT = 360 / MAP_WORLD_WIDTH;

// The baked lattice covers an asymmetric latitude window, so shift it to
// sit centred on the plane instead of hanging below the equator.
const MAP_CENTER_LAT = (WORLD_LAT_MIN + WORLD_LAT_MAX) / 2;

/** Longitude/latitude to plane-local coordinates (u right, v up). */
export const lonToU = (lon: number) => lon / DEG_PER_UNIT;
export const latToV = (lat: number) => (lat - MAP_CENTER_LAT) / DEG_PER_UNIT;

export type Camera = {
  /** Row-major 3x3 rotation, plane-local -> camera-aligned world. */
  m: readonly number[];
  panX: number;
  panY: number;
  distance: number;
  focal: number;
  centerX: number;
  centerY: number;
  /** Depth of the plane origin, used to normalise the perspective scale. */
  nominalZ: number;
};

export type Projected = {
  x: number;
  y: number;
  /** Camera-space depth. Larger = further away. */
  z: number;
  /** 1 at the plane origin, >1 nearer the camera, <1 further. */
  scale: number;
  visible: boolean;
};

const mul3 = (a: readonly number[], b: readonly number[]) => {
  const out = new Array<number>(9);
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 3; c++) {
      out[r * 3 + c] =
        a[r * 3] * b[c] + a[r * 3 + 1] * b[3 + c] + a[r * 3 + 2] * b[6 + c];
    }
  }
  return out;
};

const rotX = (a: number) => {
  const s = Math.sin(a);
  const c = Math.cos(a);
  return [1, 0, 0, 0, c, -s, 0, s, c];
};

const rotY = (a: number) => {
  const s = Math.sin(a);
  const c = Math.cos(a);
  return [c, 0, s, 0, 1, 0, -s, 0, c];
};

const rotZ = (a: number) => {
  const s = Math.sin(a);
  const c = Math.cos(a);
  return [c, -s, 0, s, c, 0, 0, 0, 1];
};

// Everything below uses one full cycle (or an exact divisor) of the clip
// length, so the camera returns to its starting attitude on the last frame.
export const cameraAtFrame = (frame: number, geometry: MapGeometry): Camera => {
  const pitch =
    (PITCH_BASE_DEG + PITCH_AMP_DEG * Math.sin((frame / PITCH_PERIOD) * TAU)) *
    DEG;
  const yaw =
    (YAW_BASE_DEG +
      YAW_AMP_DEG * Math.sin((frame / YAW_PERIOD) * TAU - Math.PI / 5)) *
    DEG;
  const roll =
    ROLL_AMP_DEG * Math.sin((frame / ROLL_PERIOD) * TAU + Math.PI / 3) * DEG;

  // Rz * Ry * Rx: pitch the plane back first, then swing it, then let the
  // horizon cant very slightly.
  const m = mul3(rotZ(roll), mul3(rotY(yaw), rotX(pitch)));

  const panX = PAN_X_AMP * Math.sin((frame / PAN_PERIOD) * TAU + Math.PI / 7);
  const panY =
    PAN_Y_AMP * Math.sin((frame / PAN_PERIOD) * TAU + Math.PI / 2.3) - 0.02;
  // Pushes in and eases back out across the clip.
  const distance =
    CAMERA_DISTANCE - DOLLY_AMP * Math.sin((frame / DOLLY_PERIOD) * TAU);

  return {
    m,
    panX,
    panY,
    distance,
    focal: geometry.focal,
    centerX: geometry.centerX,
    centerY: geometry.centerY,
    nominalZ: distance,
  };
};

// Anything at or behind the lens is dropped rather than projected, which
// would otherwise mirror geometry to the far side of the frame.
const NEAR_PLANE = 0.08;

/**
 * Projects a plane-local point. `w` lifts the point off the plane along the
 * plane normal, which is how tickers float in front of the map instead of
 * being painted onto it.
 */
export const project = (
  cam: Camera,
  u: number,
  v: number,
  w = 0,
): Projected => {
  const { m } = cam;
  const X = m[0] * u + m[1] * v + m[2] * w + cam.panX;
  const Y = m[3] * u + m[4] * v + m[5] * w + cam.panY;
  const Z = m[6] * u + m[7] * v + m[8] * w + cam.distance;

  if (Z <= NEAR_PLANE) {
    return { x: 0, y: 0, z: Z, scale: 0, visible: false };
  }

  const invZ = 1 / Z;
  return {
    x: cam.centerX + cam.focal * X * invZ,
    // Screen y grows downward, plane v grows up.
    y: cam.centerY - cam.focal * Y * invZ,
    z: Z,
    scale: cam.nominalZ * invZ,
    visible: true,
  };
};

/** Convenience wrapper for the common lon/lat case. */
export const projectLonLat = (cam: Camera, lon: number, lat: number, w = 0) =>
  project(cam, lonToU(lon), latToV(lat), w);

/**
 * Depth shading. Far geometry loses brightness so the plane recedes into
 * the haze instead of staying uniformly lit to the horizon.
 */
export const depthFade = (scale: number) => {
  const t = Math.min(1.45, Math.max(0, scale));
  // Eased so the falloff bites in the distance and flattens out up close.
  return Math.min(1, 0.1 + 0.9 * Math.pow(t / 1.45, 1.35) * 1.45);
};
