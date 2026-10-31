import * as THREE from "three";
import { DEG, Key, latLonToVec3, sampleTrack } from "./math";

const DIST = 1.22;
const TILT = 43;

/** Camera keyframes (one per second, timed against the reference): [lat, lon, distance (earth radii), tilt (deg from nadir), heading (deg, 0 = north up)] */
export const CAMERA_KEYS: Key[] = [
  { t: 0.0, v: [33, -95, DIST, TILT, 0] },
  { t: 1.0, v: [31, -92, DIST, TILT, 0] },
  { t: 2.0, v: [28, -88, DIST, TILT, 2] },
  { t: 3.0, v: [21, -80, DIST, TILT, 4] },
  { t: 4.0, v: [17, -74, DIST, TILT, 6] },
  { t: 5.0, v: [14, -68, DIST, TILT, 8] },
  { t: 6.0, v: [12, -62, DIST, TILT, 10] },
  { t: 7.0, v: [10, -55, DIST, TILT, 12] },
  { t: 8.0, v: [8, -48, DIST, TILT, 14] },
  { t: 9.0, v: [8, -40, DIST, TILT, 14] },
  { t: 10.0, v: [9, -33, DIST, TILT, 12] },
  { t: 11.0, v: [12, -23, DIST, TILT, 10] },
  { t: 12.0, v: [20, -6, DIST, TILT, 6] },
  { t: 13.0, v: [25, 10, DIST, TILT, 4] },
  { t: 14.0, v: [26, 24, DIST, TILT, 2] },
  { t: 15.0, v: [26, 36, DIST, TILT, 0] },
  { t: 16.0, v: [27, 49, DIST, TILT, 0] },
  { t: 17.0, v: [28, 62, DIST, TILT, 0] },
  { t: 18.0, v: [28, 76, DIST, TILT, 0] },
  { t: 19.0, v: [30, 87, DIST, TILT, 0] },
  { t: 20.0, v: [30, 96, DIST, TILT, 0] },
  { t: 21.0, v: [30, 105, DIST, TILT, 2] },
  { t: 22.0, v: [28, 112, DIST, TILT, 4] },
  { t: 23.0, v: [24, 117, DIST, TILT, 6] },
  { t: 24.0, v: [19, 120, DIST, TILT, 6] },
  { t: 25.0, v: [11, 118, DIST, TILT, 6] },
  { t: 26.0, v: [5, 118, DIST, TILT, 6] },
  { t: 27.0, v: [-3, 121, DIST, TILT, 6] },
  { t: 28.0, v: [-10, 126, DIST, TILT, 4] },
  { t: 29.0, v: [-14, 129, DIST, TILT, 2] },
  { t: 30.0, v: [-17, 131, DIST, TILT, 0] },
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
