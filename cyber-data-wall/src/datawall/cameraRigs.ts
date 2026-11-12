import * as THREE from "three";
import { lerp, smoothstep } from "../lib/useThreeScene";

export type CameraRig = {
  fov: number;
  fogDensity: number;
  aperture: number;
  maxBlur: number;
  fanSeed: number;
  fanRegion: { x0: number; x1: number; y0: number; y1: number };
  focus: (t: number) => number;
  apply: (camera: THREE.PerspectiveCamera, t: number, duration: number) => void;
};

const ease = (x: number) => x * x * (3 - 2 * x);

/**
 * V1 – matches the reference: low-angle oblique view of the wall, rolled so the
 * racks run diagonally down to the right, with a slow lateral drift and a
 * gentle hand-held sway.
 */
export const LOW_ANGLE_DRIFT: CameraRig = {
  fov: 33,
  fogDensity: 0.022,
  aperture: 0.0009,
  maxBlur: 0.012,
  fanSeed: 7,
  fanRegion: { x0: 4, x1: 26, y0: 14, y1: 21 },
  focus: (t) => lerp(28.5, 29.5, smoothstep(0, 19, t)),
  apply: (camera, t, duration) => {
    const k = ease(Math.min(1, t / duration));
    const pos = new THREE.Vector3(
      lerp(-10.0, -7.2, k) + Math.sin(t * 0.37) * 0.1,
      lerp(-1.6, -0.8, k) + Math.sin(t * 0.53 + 1.0) * 0.07,
      lerp(13.6, 13.2, k),
    );
    const target = new THREE.Vector3(
      lerp(12.0, 14.5, k) + Math.sin(t * 0.29 + 2.0) * 0.1,
      lerp(11.0, 11.8, k),
      0,
    );
    camera.position.copy(pos);
    camera.up.set(0, 1, 0);
    camera.lookAt(target);
    // roll so the racks descend to the right
    camera.rotateZ(THREE.MathUtils.degToRad(lerp(-17, -15, k) + Math.sin(t * 0.21) * 0.3));
  },
};
