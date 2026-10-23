import * as THREE from "three";

export type CameraShot = {
  fov: number;
  // t in seconds, p in [0, 1] over the whole clip.
  // focus is the world point kept sharp.
  pose: (
    t: number,
    p: number,
  ) => { position: THREE.Vector3; target: THREE.Vector3; focus: THREE.Vector3 };
  exposure: number;
  aperture: number; // BokehPass units (~1e-4 is a shallow DOF at cm scale)
  maxBlur: number;
};

// Version 1: matches the reference - close, oblique view of one rack with a
// slow, constant upward crane move (the content drifts down through frame).
export const craneUp: CameraShot = {
  fov: 38,
  pose: (_t, p) => {
    const y = 92 + 21 * p;
    return {
      position: new THREE.Vector3(-5, y, 46),
      target: new THREE.Vector3(32, y - 2, -2),
      focus: new THREE.Vector3(16, y, 0),
    };
  },
  exposure: 1.05,
  aperture: 0.00035,
  maxBlur: 0.012,
};

// Version 2: alternative camera - a low-angle lateral tracking shot that
// glides right along the row of racks, looking slightly up with parallax.
export const lateralTrack: CameraShot = {
  fov: 40,
  pose: (_t, p) => {
    const e = p * p * (3 - 2 * p) * 0.35 + p * 0.65; // gentle ease
    const x = -200 + 140 * e;
    return {
      position: new THREE.Vector3(x, 62, 58 - 6 * e),
      target: new THREE.Vector3(x + 38, 118, -4),
      focus: new THREE.Vector3(x + 30, 100, 0),
    };
  },
  exposure: 0.85,
  aperture: 0.0003,
  maxBlur: 0.01,
};
