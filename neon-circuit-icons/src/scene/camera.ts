import { Vector3 } from 'three';
import { TAU } from '../lib/loop';

// Camera path: a closed sway around the icon. Whole-number frequencies only.
// Identical for every composition (the target does not depend on the icon).

export const FOCAL_MM = 37;
export const CAMERA_FOV = (2 * Math.atan(12 / FOCAL_MM) * 180) / Math.PI; // 24 mm sensor height
export const TARGET = new Vector3(0, 0.6, 0);
const DEG = Math.PI / 180;

export const cameraAt = (t: number, out = new Vector3()) => {
  const yaw = 25 * DEG * Math.sin(TAU * t + 0.6);
  const pitch = 30 * DEG + 2.5 * DEG * Math.sin(TAU * 2 * t + 1.1);
  const dist = 4.6 + 0.16 * Math.cos(TAU * t);
  return out.set(
    TARGET.x + dist * Math.sin(yaw) * Math.cos(pitch),
    TARGET.y + dist * Math.sin(pitch),
    TARGET.z + dist * Math.cos(yaw) * Math.cos(pitch),
  );
};
