import * as THREE from "three";
import { lerp } from "../lib/useThreeScene";

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

// tunable framing (world units)
const POS0 = new THREE.Vector3(1.0, -3.0, 7.6);
const POS1 = new THREE.Vector3(2.6, -2.5, 7.4);
const TGT0 = new THREE.Vector3(9.0, 8.0, 0);
const TGT1 = new THREE.Vector3(10.6, 8.6, 0);

/**
 * Close, steep low-angle view up the wall, rolled so the racks run diagonally
 * down to the right, with a slow lateral drift and a gentle hand-held sway.
 * Shared by V1 and V2 (V2 changes the colour palette only).
 */
export const LOW_ANGLE_DRIFT: CameraRig = {
  fov: 21,
  fogDensity: 0.03,
  aperture: 0.009,
  maxBlur: 0.026,
  fanSeed: 7,
  fanRegion: { x0: 8, x1: 12.5, y0: 8.6, y1: 10.2 },
  focus: (t) => lerp(17.2, 17.8, Math.min(1, t / 19)),
  apply: (camera, t, duration) => {
    const k = ease(Math.min(1, t / duration));
    const pos = new THREE.Vector3().lerpVectors(POS0, POS1, k);
    pos.x += Math.sin(t * 0.37) * 0.05;
    pos.y += Math.sin(t * 0.53 + 1.0) * 0.04;
    const target = new THREE.Vector3().lerpVectors(TGT0, TGT1, k);
    target.x += Math.sin(t * 0.29 + 2.0) * 0.06;
    camera.position.copy(pos);
    camera.up.set(0, 1, 0);
    camera.lookAt(target);
    // roll so the racks descend to the right
    camera.rotateZ(THREE.MathUtils.degToRad(lerp(-24, -22, k) + Math.sin(t * 0.21) * 0.3));
  },
};
