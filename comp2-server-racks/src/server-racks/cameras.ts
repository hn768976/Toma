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
// slow, steady downward crane move (the content drifts up through frame).
export const craneDown: CameraShot = {
  fov: 37,
  pose: (_t, p) => {
    // Near-linear descent with a slight ease at both ends.
    const e = p * 0.85 + 0.15 * (p * p * (3 - 2 * p));
    const y = 144 - 58 * e;
    return {
      position: new THREE.Vector3(-3, y, 42),
      target: new THREE.Vector3(40, y - 2, -6),
      focus: new THREE.Vector3(24, y, 0),
    };
  },
  exposure: 1.15,
  aperture: 0.0006,
  maxBlur: 0.012,
};

// Version 2: alternative camera - a low-angle lateral tracking shot that
// glides right along the row of racks, looking slightly up with parallax.
export const lateralTrack: CameraShot = {
  fov: 37,
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
