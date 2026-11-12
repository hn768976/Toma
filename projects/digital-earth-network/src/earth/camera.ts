import * as THREE from "three";
import { Key, monotone } from "../lib/spline";

export type Variant = "v1" | "v2";

export type CameraState = {
  position: THREE.Vector3;
  quaternion: THREE.Quaternion;
  fov: number;
  /** Distance (world units) that is in perfect focus, for the label depth of field. */
  focus: number;
  /** Earth spin around its own axis, radians. */
  earthSpin: number;
  /** Intensity of the orange city-light hot spots. */
  cityGlow: number;
};

const DEG = Math.PI / 180;

type Track = {
  dist: Key[];
  az: Key[]; // camera azimuth around the globe (deg)
  el: Key[]; // camera elevation above the equator plane (deg)
  pitch: Key[]; // look up away from the globe centre (deg) -> pushes the globe down in frame
  yaw: Key[]; // look right of the globe centre (deg) -> pushes the globe left in frame
  roll: Key[]; // dutch angle (deg)
  fov: Key[];
  spin: Key[]; // earth spin (deg)
  city: Key[];
};

/**
 * Version 1 - matches the reference: the shot opens in deep space among
 * floating data read-outs looking up off the horizon, tilts down so the
 * limb of the Earth rises from the bottom of frame, then pulls back in one
 * long move until the whole planet sits centred and slowly turning.
 */
const V1: Track = {
  dist: [
    [0, 1.42],
    [1.6, 1.46],
    [3, 1.62],
    [4, 1.75],
    [5, 1.97],
    [6, 2.35],
    [7, 3.0],
    [8, 4.0],
    [9.3, 4.6],
    [11, 5.05],
    [29.733, 5.3],
  ],
  az: [
    [0, 4],
    [4, 0],
    [8, -4],
    [12, -6],
    [29.733, -9],
  ],
  el: [
    [0, 40],
    [4, 33],
    [8, 24],
    [12, 18],
    [29.733, 14],
  ],
  pitch: [
    [0, 74],
    [1.2, 70],
    [2.1, 57],
    [3, 46],
    [4, 37],
    [5, 27],
    [6, 17],
    [7, 9],
    [8, 3.5],
    [9.3, 1],
    [11, 0],
    [29.733, 0],
  ],
  yaw: [
    [0, 0],
    [3, 4],
    [5, 10],
    [6.3, 12],
    [7.3, 9],
    [8.3, 3],
    [9.5, 0.6],
    [11, 0],
    [29.733, 0],
  ],
  roll: [
    [0, -7],
    [2.5, -6],
    [4, -3],
    [6, 0],
    [29.733, 0],
  ],
  fov: [
    [0, 42],
    [29.733, 40],
  ],
  spin: [
    [0, -112],
    [8, -100],
    [29.733, -68],
  ],
  city: [
    [0, 0.2],
    [2.3, 0.6],
    [4.2, 1],
    [6.2, 1],
    [8, 0.45],
    [10, 0.22],
    [29.733, 0.22],
  ],
};

/**
 * Version 2 - alternative camera movement: a continuous orbital fly-around.
 * The camera starts low and banked over the night side among the city
 * lights, sweeps across the terminator and up over the northern hemisphere
 * in a wide 120 degree arc while pulling out, and ends on a high
 * three-quarter angle, still orbiting so the data network keeps
 * parallaxing past the lens.
 */
const V2: Track = {
  dist: [
    [0, 1.3],
    [2.5, 1.45],
    [5, 1.9],
    [8, 2.7],
    [11, 3.5],
    [15, 4.1],
    [22, 4.4],
    [29.733, 4.3],
  ],
  az: [
    [0, -165],
    [4, -148],
    [8, -122],
    [12, -98],
    [16, -78],
    [22, -60],
    [29.733, -44],
  ],
  el: [
    [0, 8],
    [4, 18],
    [8, 32],
    [12, 44],
    [16, 50],
    [22, 52],
    [29.733, 50],
  ],
  pitch: [
    [0, 50],
    [2.5, 44],
    [5, 30],
    [8, 16],
    [11, 6],
    [14, 2],
    [29.733, 0],
  ],
  yaw: [
    [0, -14],
    [4, -16],
    [8, -12],
    [12, -9],
    [16, -8],
    [29.733, -8],
  ],
  roll: [
    [0, 24],
    [4, 16],
    [8, 8],
    [12, 3],
    [16, -2],
    [29.733, -4],
  ],
  fov: [
    [0, 46],
    [29.733, 38],
  ],
  spin: [
    [0, -118],
    [29.733, -78],
  ],
  city: [
    [0, 0.85],
    [3, 1],
    [7, 1],
    [11, 0.5],
    [14, 0.3],
    [29.733, 0.3],
  ],
};

const TRACKS: Record<Variant, Track> = { v1: V1, v2: V2 };

const tmpM = new THREE.Matrix4();
const qLocal = new THREE.Quaternion();
const eLocal = new THREE.Euler();
const UP = new THREE.Vector3(0, 1, 0);
const ORIGIN = new THREE.Vector3(0, 0, 0);

export const cameraAt = (variant: Variant, t: number): CameraState => {
  const k = TRACKS[variant];
  const d = monotone(k.dist, t);
  const az = monotone(k.az, t) * DEG;
  const el = monotone(k.el, t) * DEG;
  const position = new THREE.Vector3(
    d * Math.cos(el) * Math.sin(az),
    d * Math.sin(el),
    d * Math.cos(el) * Math.cos(az),
  );
  tmpM.lookAt(position, ORIGIN, UP);
  const quaternion = new THREE.Quaternion().setFromRotationMatrix(tmpM);
  // Local offsets: yaw (look right = negative Y rotation), pitch (look up), roll.
  eLocal.set(
    monotone(k.pitch, t) * DEG,
    -monotone(k.yaw, t) * DEG,
    monotone(k.roll, t) * DEG,
    "YXZ",
  );
  qLocal.setFromEuler(eLocal);
  quaternion.multiply(qLocal);
  // Focus distance follows the visible surface of the globe.
  const focus = Math.max(0.6, d - 0.85);
  return {
    position,
    quaternion,
    fov: monotone(k.fov, t),
    focus,
    earthSpin: monotone(k.spin, t) * DEG,
    cityGlow: monotone(k.city, t),
  };
};
