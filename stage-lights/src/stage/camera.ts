import * as THREE from "three";
import { BASE_CAMERA } from "./lights";

export type CameraMove = "locked-off" | "crane-arc";

export type Shot = {
  position: THREE.Vector3;
  target: THREE.Vector3;
  fov: number;
  roll: number;
};

const STAGE_CENTER = new THREE.Vector3(0, 1.2, -1);

/** Smooth in/out easing with continuous velocity. */
const easeInOutSine = (u: number) => 0.5 - 0.5 * Math.cos(Math.PI * u);

/**
 * Camera for normalised time u in [0, 1].
 *  - "locked-off": static front-on camera, framed like the reference clip.
 *  - "crane-arc": low-angle crane shot that arcs ~55 degrees around the rig
 *    while rising and pushing in, so the volumetric beams read in depth.
 */
export const cameraAt = (move: CameraMove, u: number): Shot => {
  if (move === "locked-off") {
    return {
      position: BASE_CAMERA.position.clone(),
      target: new THREE.Vector3(0, 0, 0),
      fov: BASE_CAMERA.fov,
      roll: 0,
    };
  }
  const e = easeInOutSine(THREE.MathUtils.clamp(u, 0, 1));
  const azimuth = THREE.MathUtils.degToRad(THREE.MathUtils.lerp(-30, 25, e));
  const radius = THREE.MathUtils.lerp(11.5, 9.0, e);
  const height = THREE.MathUtils.lerp(-3.4, -0.6, e);
  const position = new THREE.Vector3(
    STAGE_CENTER.x + Math.sin(azimuth) * radius,
    height,
    STAGE_CENTER.z + Math.cos(azimuth) * radius,
  );
  const target = new THREE.Vector3(
    THREE.MathUtils.lerp(-0.8, 0.6, e),
    THREE.MathUtils.lerp(1.9, 1.1, e),
    STAGE_CENTER.z,
  );
  return {
    position,
    target,
    fov: THREE.MathUtils.lerp(58, 50, e),
    roll: THREE.MathUtils.lerp(-3, 2, e),
  };
};
