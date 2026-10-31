import * as THREE from "three";
import { DEG, Key, latLonToVec3, sampleTrack } from "./math";

/**
 * Camera keyframes, timed against the reference (eases in from rest over the US,
 * pulls back while crossing the Atlantic, eases out over Australia):
 * [lat, lon, distance (earth radii), tilt (deg from nadir), heading (deg, 0 = north up)]
 */
export const CAMERA_KEYS: Key[] = [
  { t: 0, v: [35, -95, 1.08, 40, -4] },
  { t: 1.5, v: [34.4, -93.8, 1.1, 40, -4] },
  { t: 3, v: [27.5, -86.5, 1.12, 41, -2] },
  { t: 4.5, v: [19.5, -77.5, 1.28, 42, 2] },
  { t: 6, v: [13, -66, 1.45, 43, 6] },
  { t: 7.5, v: [8.5, -55, 1.6, 44, 10] },
  { t: 9, v: [6.5, -44, 1.7, 44, 12] },
  { t: 10.5, v: [8.5, -31, 1.75, 44, 12] },
  { t: 12, v: [17, -13, 1.75, 44, 8] },
  { t: 13.5, v: [27, 7, 1.75, 44, 4] },
  { t: 15, v: [31, 27, 1.75, 44, 2] },
  { t: 16.5, v: [32, 46, 1.75, 44, 0] },
  { t: 18, v: [33, 65, 1.75, 44, 0] },
  { t: 19.5, v: [35, 85, 1.75, 44, 0] },
  { t: 21, v: [35, 99, 1.75, 44, 0] },
  { t: 22.5, v: [30.5, 109, 1.75, 44, 2] },
  { t: 24, v: [20.5, 115, 1.8, 44, 4] },
  { t: 25.5, v: [10, 118, 1.85, 45, 6] },
  { t: 27, v: [-2, 122, 1.92, 45, 5] },
  { t: 28.5, v: [-12, 128, 1.98, 45, 4] },
  { t: 30, v: [-14.5, 130.5, 2.0, 45, 4] },
];

export type CameraState = {
  target: THREE.Vector3;
  position: THREE.Vector3;
  up: THREE.Vector3;
  lat: number;
  lon: number;
};

/** Place a camera above (lat, lon) looking down at `tilt` degrees from nadir, heading towards `heading`. */
export const cameraFromParams = (v: number[], out?: CameraState): CameraState => {
  const [lat, lon, dist, tilt, heading] = v;
  const target = latLonToVec3(lat, lon, 1, out?.target);
  const n = target.clone().normalize();
  const east = new THREE.Vector3(n.z, 0, -n.x).normalize();
  const north = new THREE.Vector3().crossVectors(n, east).normalize();
  const h = heading * DEG;
  const fwd = north.clone().multiplyScalar(Math.cos(h)).addScaledVector(east, Math.sin(h));
  const t = tilt * DEG;
  const offset = n.clone().multiplyScalar(Math.cos(t)).addScaledVector(fwd, -Math.sin(t)).multiplyScalar(dist);
  const position = (out?.position ?? new THREE.Vector3()).copy(target).add(offset);
  // up vector = forward direction projected so the horizon stays level
  const up = (out?.up ?? new THREE.Vector3()).copy(fwd).multiplyScalar(Math.cos(t)).addScaledVector(n, Math.sin(t)).normalize();
  return { target, position, up, lat, lon };
};

export const cameraAt = (keys: Key[], time: number) => cameraFromParams(sampleTrack(keys, time));
