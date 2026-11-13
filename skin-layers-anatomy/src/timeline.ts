import * as THREE from "three";
import { easeInOutSine, lerp, ramp } from "./scene/util";

export const FPS = 30;
export const DURATION_SECONDS = 12;
export const DURATION_FRAMES = FPS * DURATION_SECONDS; // 360
export const WIDTH = 3840;
export const HEIGHT = 2160;

export type Variant = "reference" | "orbit";

/** Timing (seconds), measured from the reference clip. */
export const T = {
  explodeStart: 0.0,
  explodeEnd: 1.95,
  labelsStart: 1.3,
  labelStagger: 0.12,
  labelFade: 0.28,
  labelsOutStart: 8.35,
  labelsOutEnd: 8.9,
  collapseStart: 8.4,
  collapseEnd: 10.4,
};

/** 0 = layers stacked, 1 = layers fully separated. */
// The reference moves at a nearly constant rate, so the ease is kept light.
const softEase = (x: number) => 0.6 * x + 0.4 * easeInOutSine(x);
export const explodeAmount = (t: number) =>
  softEase(ramp(t, T.explodeStart, T.explodeEnd)) *
  (1 - softEase(ramp(t, T.collapseStart, T.collapseEnd)));

/** Opacity of the label with the given stagger index. */
export const labelOpacity = (t: number, index: number) => {
  const start = T.labelsStart + index * T.labelStagger;
  return (
    ramp(t, start, start + T.labelFade) *
    (1 - ramp(t, T.labelsOutStart, T.labelsOutEnd))
  );
};

const camera = new THREE.PerspectiveCamera(20, WIDTH / HEIGHT, 0.5, 100);

/**
 * Version 1 uses the locked-off three-quarter view of the reference.
 * Version 2 keeps the same staging but orbits and cranes around the model.
 */
export const getCamera = (t: number, variant: Variant) => {
  let azimuth = 28;
  let elevation = 7.5;
  let radius = 19.6;
  if (variant === "orbit") {
    const k = easeInOutSine(t / DURATION_SECONDS);
    azimuth = lerp(6, 64, k);
    elevation = lerp(4, 21, k);
    radius = lerp(21, 20.4, k);
  }
  const az = THREE.MathUtils.degToRad(azimuth);
  const el = THREE.MathUtils.degToRad(elevation);
  const target = new THREE.Vector3(0.12, -0.1, 0);
  camera.position.set(
    target.x + radius * Math.cos(el) * Math.sin(az),
    target.y + radius * Math.sin(el),
    target.z + radius * Math.cos(el) * Math.cos(az),
  );
  camera.lookAt(target);
  camera.updateMatrixWorld(true);
  camera.updateProjectionMatrix();
  return camera;
};

/** Project a world point to composition pixels (3840x2160 space). */
export const project = (
  cam: THREE.PerspectiveCamera,
  x: number,
  y: number,
  z: number,
) => {
  const v = new THREE.Vector3(x, y, z).project(cam);
  return { x: (v.x * 0.5 + 0.5) * WIDTH, y: (-v.y * 0.5 + 0.5) * HEIGHT };
};
