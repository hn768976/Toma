import * as THREE from "three";
import type { CameraKind } from "./config";

/**
 * All motion is a pure function of time (seconds) so that every frame is
 * deterministic and can be rendered in any order / in parallel.
 */

const TAU = Math.PI * 2;

const easeInOut = (x: number) => {
  const c = Math.min(1, Math.max(0, x));
  return c * c * (3 - 2 * c);
};

const easeInOutSine = (x: number) => {
  const c = Math.min(1, Math.max(0, x));
  return -(Math.cos(Math.PI * c) - 1) / 2;
};

export type RingPose = {
  position: THREE.Vector3;
  quaternion: THREE.Quaternion;
};

/**
 * Gentle floating motion measured from the references: a slow drift to the
 * right (~0.15 units over the clip), a ~3.6 s bob/pitch cycle, a slower roll
 * and a very slow spin.
 */
export const ringPose = (t: number): RingPose => {
  const drift = 0.17 * easeInOutSine(t / 7.5) - 0.085;
  const bob = 0.018 * Math.sin((TAU * t) / 3.6 + 0.4);
  const pitch = 0.05 * Math.sin((TAU * t) / 3.6 + 1.3);
  const roll = 0.035 * Math.sin((TAU * t) / 5.2 + 0.2);
  const yaw = 0.09 * (t / 10) + 0.02 * Math.sin((TAU * t) / 6.5);

  const position = new THREE.Vector3(drift, 0.3 + bob, 0.02 * Math.sin((TAU * t) / 7));
  const euler = new THREE.Euler(pitch, yaw, roll, "YXZ");
  const quaternion = new THREE.Quaternion().setFromEuler(euler);
  return { position, quaternion };
};

export type CameraPose = {
  position: THREE.Vector3;
  target: THREE.Vector3;
  fov: number;
};

const sphericalCamera = (
  target: THREE.Vector3,
  elevationDeg: number,
  azimuthDeg: number,
  distance: number,
): THREE.Vector3 => {
  const el = THREE.MathUtils.degToRad(elevationDeg);
  const az = THREE.MathUtils.degToRad(azimuthDeg);
  return new THREE.Vector3(
    target.x + distance * Math.cos(el) * Math.sin(az),
    target.y + distance * Math.sin(el),
    target.z + distance * Math.cos(el) * Math.cos(az),
  );
};

/** Static camera matching the reference framing. */
const STATIC_TARGET = new THREE.Vector3(-1.246, -0.45, -0.303);
const STATIC_ELEVATION = 45.78;
const STATIC_AZIMUTH = 0;
const STATIC_DISTANCE = 8.546;
const STATIC_FOV = 32;

export const cameraPose = (kind: CameraKind, t: number): CameraPose => {
  if (kind === "static") {
    return {
      position: sphericalCamera(STATIC_TARGET, STATIC_ELEVATION, STATIC_AZIMUTH, STATIC_DISTANCE),
      target: STATIC_TARGET.clone(),
      fov: STATIC_FOV,
    };
  }

  // Version 2: a slow crane-down orbit. The camera begins almost overhead,
  // sweeps ~60 degrees around the float while descending to a low
  // three-quarter angle and pushing in.
  const p = easeInOut(t / 10);
  const elevation = THREE.MathUtils.lerp(78, 36, p);
  const azimuth = THREE.MathUtils.lerp(-38, 26, p);
  const distance = THREE.MathUtils.lerp(10.4, 7.6, p);
  const target = new THREE.Vector3(
    THREE.MathUtils.lerp(0.0, -0.15, p),
    -0.35,
    THREE.MathUtils.lerp(0.55, 0.85, p),
  );
  return {
    position: sphericalCamera(target, elevation, azimuth, distance),
    target,
    fov: 34,
  };
};
