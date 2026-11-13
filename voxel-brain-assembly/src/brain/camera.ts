import * as THREE from "three";
import { easeInOutCubic } from "./random";

export type CameraVariant = "match" | "orbit";

export type CameraState = {
  position: THREE.Vector3;
  target: THREE.Vector3;
  fov: number;
  /** Focus distance for the depth-of-field pass. */
  focus: number;
};

const deg = Math.PI / 180;

/**
 * V1 "match": the reference's low, almost-static frontal view with a very
 * slow push-in. V2 "orbit": an elevated three-quarter view that sweeps
 * ~75 degrees around the pedestal while descending, revealing the brain's
 * volume as it assembles.
 */
export const cameraAt = (
  variant: CameraVariant,
  t: number,
  duration: number,
): CameraState => {
  const p = easeInOutCubic(Math.min(Math.max(t / duration, 0), 1));
  if (variant === "match") {
    const position = new THREE.Vector3(0, 2.43 - 0.04 * p, 13.7 - 0.55 * p);
    const target = new THREE.Vector3(-1.25, 1.64, 0);
    return { position, target, fov: 40, focus: position.distanceTo(new THREE.Vector3(0, 1.8, 0)) };
  }
  const center = new THREE.Vector3(0, 2.15, 0);
  const azimuth = (-44 + 76 * p) * deg; // 0 = straight on, + = from the right
  const elevation = (22 - 11 * p) * deg;
  const radius = 13.2 - 1.4 * p;
  const position = new THREE.Vector3(
    center.x + Math.sin(azimuth) * Math.cos(elevation) * radius,
    center.y + Math.sin(elevation) * radius,
    center.z + Math.cos(azimuth) * Math.cos(elevation) * radius,
  );
  return { position, target: center.clone(), fov: 32, focus: radius };
};
