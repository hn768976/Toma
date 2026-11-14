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
    // Gentle "handheld" float of a few pixels, measured from the reference.
    const fx = 0.05 * Math.sin(t * 0.83 + 0.4) + 0.025 * Math.sin(t * 2.07 + 1.3);
    const fy = 0.035 * Math.sin(t * 1.17 + 2.1) + 0.015 * Math.sin(t * 2.6);
    // Framing solved from the reference: horizon ~40% down, pedestal centre at
    // 57% across and its base at 67% down, 52-degree lens, gentle push-in.
    const position = new THREE.Vector3(-1.12 + fx, 2.35 - 0.03 * p + fy, 10.1 - 0.4 * p);
    const target = new THREE.Vector3(-1.12 + fx * 0.4, 1.28 + fy * 0.4, 0);
    return { position, target, fov: 52, focus: position.distanceTo(new THREE.Vector3(0, 1.4, 0.5)) };
  }
  const center = new THREE.Vector3(0.1, 1.9, 0);
  const azimuth = (-44 + 76 * p) * deg; // 0 = straight on, + = from the right
  const elevation = (22 - 11 * p) * deg;
  const radius = 11.8 - 1.4 * p;
  const position = new THREE.Vector3(
    center.x + Math.sin(azimuth) * Math.cos(elevation) * radius,
    center.y + Math.sin(elevation) * radius,
    center.z + Math.cos(azimuth) * Math.cos(elevation) * radius,
  );
  return { position, target: center.clone(), fov: 40, focus: radius };
};
