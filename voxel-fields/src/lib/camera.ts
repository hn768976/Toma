import * as THREE from "three";
import { loopPhase } from "./time";

const TAU = Math.PI * 2;

// Camera: ~38 deg above the horizon, turned ~30 deg so rows run diagonally,
// 50 mm lens (35 mm film gauge).
export const CAM = {
  distance: 46,
  elevation: (38 * Math.PI) / 180,
  azimuth: (-45 * Math.PI) / 180,
  focalLength: 50,
  // Closed drift path, a couple of percent of the frame width.
  drift: 0.7,
};

export const cameraFrame = (frame: number) => {
  const t = loopPhase(frame);
  const { distance, elevation, azimuth, drift } = CAM;
  // Pure translation on a closed loop (whole-number frequencies): no orbit.
  const tx = drift * Math.sin(TAU * t);
  const tz = drift * 0.6 * Math.sin(TAU * 2 * t + 0.7);
  const target = new THREE.Vector3(tx, -1, tz);
  const offset = new THREE.Vector3(
    Math.cos(elevation) * Math.sin(azimuth),
    Math.sin(elevation),
    Math.cos(elevation) * Math.cos(azimuth),
  ).multiplyScalar(distance);
  return { position: target.clone().add(offset), target };
};

