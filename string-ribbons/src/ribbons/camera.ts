import { V3, cross, norm, sub } from "./math";
import { LOOP_FRAMES, sceneCentroid } from "./scene";

export type Camera = {
  eye: V3;
  target: V3;
  roll: number;
  /** focal length in screen heights (1.1 ~ 49° vertical FOV) */
  focal: number;
  /** distance of the plane of perfect focus */
  focus: number;
  /** blur strength: CoC (in screen heights) = aperture * |1/focus - 1/z| */
  aperture: number;
  /** true when the printed paper is the ground under an overhead camera:
   *  it then turns with the camera's azimuth instead of staying screen-fixed */
  groundPaper?: boolean;
};

export type CameraRig = (frame: number, durationInFrames: number) => Camera;

/**
 * Version 1 – matches the reference: a close, restless camera that swings
 * around the sculpture and back every 6 s (fast through the middle, lingering
 * at either end), rolling and bobbing so strands sweep past the lens in heavy
 * foreground blur while the focus breathes.
 */
export const closeOrbitRig: CameraRig = (frame) => {
  const tau = (2 * Math.PI * frame) / LOOP_FRAMES;
  const phi = 0.6 + 1.15 * Math.sin(tau);
  const radius = 2.55 + 0.25 * Math.sin(tau * 2 + 0.4);
  const eye: V3 = [
    radius * Math.sin(phi),
    0.35 * Math.sin(tau * 2 + 1.1) + 0.1,
    radius * Math.cos(phi),
  ];
  const target: V3 = [0.25 * Math.cos(tau + 0.5), 0.15 * Math.sin(tau * 2), 0.25 * Math.sin(tau + 0.5)];
  const dist = Math.hypot(eye[0] - target[0], eye[1] - target[1], eye[2] - target[2]);
  return {
    eye,
    target,
    roll: 0.45 * Math.sin(tau + 0.3) + 0.2,
    focal: 1.8,
    focus: dist * (0.8 + 0.12 * Math.sin(tau * 3 + 0.7)),
    aperture: 0.075,
  };
};

/**
 * Version 2 – alternative camera angle and movement: a high, overhead three-
 * quarter view (~50° down) that circles the whole sculpture once in 12 s at a
 * slow, steady pace with no roll – a calm "turntable" reading of the forms
 * instead of V1's low, restless fly-through. Close enough that the sheets
 * still run off the frame edges; loops seamlessly (one orbit = two morph
 * loops).
 */
export const highOrbitRig: CameraRig = (frame, durationInFrames) => {
  const t = (2 * Math.PI * frame) / Math.max(1, durationInFrames);
  const phi = t + 0.9;
  const elevation = 0.88 + 0.08 * Math.sin(2 * t); // radians above the horizon
  const radius = 2.2 + 0.12 * Math.sin(2 * t + 1.2);
  // aim at the sculpture's centre of mass so the morphing form stays composed
  const c = sceneCentroid(frame);
  const eye: V3 = [
    c[0] + radius * Math.cos(elevation) * Math.sin(phi),
    c[1] + radius * Math.sin(elevation),
    c[2] + radius * Math.cos(elevation) * Math.cos(phi),
  ];
  const target: V3 = [c[0], c[1], c[2]];
  const dist = Math.hypot(eye[0] - target[0], eye[1] - target[1], eye[2] - target[2]);
  return {
    eye,
    target,
    roll: 0,
    focal: 1.45,
    focus: dist,
    aperture: 0.06,
    groundPaper: true,
  };
};

export const RIGS = { closeOrbit: closeOrbitRig, highOrbit: highOrbitRig } as const;
export type RigName = keyof typeof RIGS;

export type View = {
  /** world -> camera space, camera looks down +z, y up */
  toCam: (p: V3) => V3;
};

export const makeView = (cam: Camera): View => {
  const fwd = norm(sub(cam.target, cam.eye));
  let right = norm(cross(fwd, [0, 1, 0]));
  let up = cross(right, fwd);
  const c = Math.cos(cam.roll), s = Math.sin(cam.roll);
  const r2: V3 = [right[0] * c + up[0] * s, right[1] * c + up[1] * s, right[2] * c + up[2] * s];
  const u2: V3 = [up[0] * c - right[0] * s, up[1] * c - right[1] * s, up[2] * c - right[2] * s];
  right = r2;
  up = u2;
  return {
    toCam: (p) => {
      const d = sub(p, cam.eye);
      return [
        d[0] * right[0] + d[1] * right[1] + d[2] * right[2],
        d[0] * up[0] + d[1] * up[1] + d[2] * up[2],
        d[0] * fwd[0] + d[1] * fwd[1] + d[2] * fwd[2],
      ];
    },
  };
};
