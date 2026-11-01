import { V3, cross, norm, sub } from "./math";
import { LOOP_FRAMES } from "./scene";

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
};

export type CameraRig = (frame: number, durationInFrames: number) => Camera;

/**
 * Version 1 – matches the reference: a close, restless orbit that circles the
 * sculpture once every 6 s, rolling and bobbing so strands sweep past the
 * lens in heavy foreground blur while the focus breathes.
 */
export const closeOrbitRig: CameraRig = (frame) => {
  const tau = (2 * Math.PI * frame) / LOOP_FRAMES;
  const phi = tau + 0.6;
  const radius = 1.62 + 0.22 * Math.sin(tau * 2 + 0.4);
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
    focal: 1.35,
    focus: dist * (0.8 + 0.12 * Math.sin(tau * 3 + 0.7)),
    aperture: 0.075,
  };
};

/**
 * Version 2 – alternative camera: a high, wide crane shot. The camera starts
 * looking down on the whole sculpture from above and slowly descends while
 * arcing 120° around it, revealing the folded sheets as complete forms with
 * only gentle depth of field.
 */
export const wideCraneRig: CameraRig = (frame, durationInFrames) => {
  const p = frame / Math.max(1, durationInFrames - 1);
  const e = p * p * (3 - 2 * p); // smoothstep ease
  const phi = -0.9 + e * ((2 * Math.PI) / 3);
  const elevation = 1.05 - 0.75 * e; // radians above the horizon
  const radius = 4.6 - 0.9 * e;
  const eye: V3 = [
    radius * Math.cos(elevation) * Math.sin(phi),
    radius * Math.sin(elevation),
    radius * Math.cos(elevation) * Math.cos(phi),
  ];
  const target: V3 = [0, 0.1 - 0.1 * e, 0];
  const dist = Math.hypot(eye[0] - target[0], eye[1] - target[1], eye[2] - target[2]);
  return {
    eye,
    target,
    roll: -0.12 + 0.18 * e,
    focal: 1.25,
    focus: dist,
    aperture: 0.06,
  };
};

export const RIGS = { closeOrbit: closeOrbitRig, wideCrane: wideCraneRig } as const;
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
