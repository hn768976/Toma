import * as THREE from "three";
import { Variant } from "./palette";

export const CLIP_SECONDS = 219 / 30;

export type CameraPose = {
  position: THREE.Vector3;
  target: THREE.Vector3;
  fov: number;
  /** distance (world units) of the focal plane */
  focus: number;
};

const smooth = (x: number) => {
  const c = Math.min(1, Math.max(0, x));
  return c * c * (3 - 2 * c);
};

const orbit = (target: THREE.Vector3, dist: number, azDeg: number, elDeg: number) => {
  const az = THREE.MathUtils.degToRad(azDeg);
  const el = THREE.MathUtils.degToRad(elDeg);
  return new THREE.Vector3(
    target.x - dist * Math.cos(el) * Math.cos(az),
    target.y + dist * Math.sin(el),
    target.z + dist * Math.cos(el) * Math.sin(az),
  );
};

/**
 * Version 1 – reference match: a long-lens, almost locked-off shot
 * (measured drift ≈ 0.5 % of frame width per second) looking down ~22°
 * across the rows, shallow depth of field focused on the hero panels.
 *
 * Version 2 – alternative camera move: a low, close crane-and-orbit that
 * sweeps ~54° around the rising core while craning up from 19° to 40°,
 * with a rack focus from a foreground panel onto the core.
 */
export const cameraAt = (variant: Variant, t: number): CameraPose => {
  const k = t / CLIP_SECONDS;
  if (variant === "v1") {
    const target = new THREE.Vector3(-0.17 + 0.15 * k, 0.6, -0.03 - 0.1 * k);
    const dist = 6.0 - 0.25 * k;
    const position = orbit(target, dist, 50 + 2.5 * k, 22);
    return { position, target, fov: 19, focus: dist - 0.45 };
  }
  const e = smooth(k);
  const target = new THREE.Vector3(0.9 + 0.2 * e, 0.5 + 0.15 * e, 0.0);
  const dist = 7.4 + 1.2 * e;
  const position = orbit(target, dist, 6 + 54 * e, 19 + 21 * e);
  // rack focus: foreground panel (~5 units) → core (dist) between 0.6 s and 2.0 s
  const rack = smooth((t - 0.6) / 1.4);
  const focus = 5.4 + (dist - 0.2 - 5.4) * rack;
  return { position, target, fov: 26, focus };
};
