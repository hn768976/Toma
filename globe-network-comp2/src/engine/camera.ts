import * as THREE from "three";
import { DEG, Key, latLonToVec3, sampleTrack } from "./math";

/**
 * V1 — matches the reference: a wide, constant-speed linear drift (no easing)
 * from the Caribbean / Pacific across the Atlantic to the Mediterranean,
 * tilted ~40 deg. Two keys -> the Hermite spline degenerates to a straight,
 * constant-velocity move.
 * [lat, lon, distance (earth radii), tilt (deg from nadir), heading (deg)]
 */
export const KEYS_V1: Key[] = [
  { t: 0, v: [12, -76, 1.75, 40, 0] },
  { t: 30, v: [27, 31, 1.75, 40, 0] },
];

/**
 * V2 — alternative camera movement: starts lower and closer over the
 * Caribbean, then rises in an orbital pull-back while banking east, ending on
 * the whole Atlantic hemisphere with the planet's limb and atmosphere in view.
 */
export const KEYS_V2: Key[] = [
  { t: 0, v: [16, -84, 0.85, 44, -14] },
  { t: 5, v: [18, -76, 1.0, 40, -10] },
  { t: 10, v: [20.5, -64, 1.35, 33, -4] },
  { t: 15, v: [22.5, -50, 1.85, 24, 2] },
  { t: 20, v: [23, -38, 2.35, 14, 6] },
  { t: 25, v: [22, -28, 2.75, 7, 7] },
  { t: 30, v: [20, -21, 2.95, 3, 6] },
];

export type CameraState = {
  target: THREE.Vector3;
  position: THREE.Vector3;
  up: THREE.Vector3;
  dist: number;
};

export const cameraFromParams = (v: number[]): CameraState => {
  const [lat, lon, dist, tilt, heading] = v;
  const target = latLonToVec3(lat, lon, 1);
  const n = target.clone().normalize();
  const east = new THREE.Vector3(n.z, 0, -n.x).normalize();
  const north = new THREE.Vector3().crossVectors(n, east).normalize();
  const h = heading * DEG;
  const fwd = north.clone().multiplyScalar(Math.cos(h)).addScaledVector(east, Math.sin(h));
  const t = tilt * DEG;
  const offset = n.clone().multiplyScalar(Math.cos(t)).addScaledVector(fwd, -Math.sin(t)).multiplyScalar(dist);
  const position = target.clone().add(offset);
  const up = fwd.clone().multiplyScalar(Math.cos(t)).addScaledVector(n, Math.sin(t)).normalize();
  return { target, position, up, dist };
};

export const cameraAt = (keys: Key[], time: number) => cameraFromParams(sampleTrack(keys, time));
