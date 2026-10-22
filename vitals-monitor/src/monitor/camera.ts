// Camera paths over the monitor plane. World units: the screen spans
// x in [0, 16/9], y in [0, 1] on the z = 0 plane, the camera sits at z > 0.

import { CameraState, Vec3 } from "./renderer";
import { fbm1, mix, smoothstep } from "./random";

const lerp3 = (a: Vec3, b: Vec3, t: number): Vec3 => [
  mix(a[0], b[0], t),
  mix(a[1], b[1], t),
  mix(a[2], b[2], t),
];

const dist = (a: Vec3, b: Vec3) =>
  Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

// Very small, slow "operator" sway so the shot never feels locked off.
const sway = (t: number, amount: number): Vec3 => [
  fbm1(t * 0.23, 41) * amount,
  fbm1(t * 0.19, 53) * amount,
  fbm1(t * 0.17, 67) * amount * 0.5,
];

const add = (a: Vec3, b: Vec3): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];

// Distance of `point` from the camera measured along the view axis (what the
// shader compares against the focus distance).
const depthAlong = (pos: Vec3, target: Vec3, point: Vec3) => {
  const f = [target[0] - pos[0], target[1] - pos[1], target[2] - pos[2]];
  const l = Math.hypot(f[0], f[1], f[2]);
  return (
    ((point[0] - pos[0]) * f[0] +
      (point[1] - pos[1]) * f[1] +
      (point[2] - pos[2]) * f[2]) /
    l
  );
};

// Version 1: long-lens oblique view across the waveforms; the middle trace and the
// numeric column at frame right are in focus. Pose solved from point matches against the reference
// (first and last frames); the shot drifts linearly between the two.
const V1_POS: Vec3 = [-2.1548, 1.1882, 2.0493];
const FOCUS_POINT: Vec3 = [1.2, 0.54, 0];

export const cameraV1 = (t: number, duration: number): CameraState => {
  const p = t / duration;
  const pos = add(V1_POS, sway(t, 0.004));
  const target = add(
    lerp3([0.7188, 0.614, 0], [0.585, 0.632, 0], p),
    sway(t + 30, 0.0025),
  );
  return {
    pos,
    target,
    roll: mix(-0.0034, -0.0693, p),
    fovY: (mix(9.74, 8.45, p) * Math.PI) / 180,
    focusDist: depthAlong(pos, target, FOCUS_POINT),
    // Sharp zone spans the middle trace through to the numeric column; the near
    // (left) part of the screen falls off into blur, as in the reference.
    focusRange: 0.085,
    aperture: 150,
  };
};

// Version 2: alternative camera. Opens near-frontal on the numeric column as the
// readouts crash to zero, then cranes out and orbits round to the opposite side
// (mirroring V1's angle), looking back along the flat-lining traces on a long lens
// while focus racks from the numbers onto the traces.
export const cameraV2 = (t: number, duration: number): CameraState => {
  const move = smoothstep(4.2, 15.5, t);
  const settle = (t / duration) * 0.04;
  const posA: Vec3 = [1.32, 0.6, 0.78];
  const posB: Vec3 = [3.75, 1.45, 1.95];
  const tgtA: Vec3 = [1.53, 0.53, 0];
  const tgtB: Vec3 = [1.08, 0.56, 0];
  // Arc the move outward (via a raised control point) instead of a straight line.
  const ctrl: Vec3 = [2.7, 0.75, 1.55];
  const u = move;
  const pos: Vec3 = [
    (1 - u) * (1 - u) * posA[0] + 2 * (1 - u) * u * ctrl[0] + u * u * posB[0],
    (1 - u) * (1 - u) * posA[1] + 2 * (1 - u) * u * ctrl[1] + u * u * posB[1],
    (1 - u) * (1 - u) * posA[2] + 2 * (1 - u) * u * ctrl[2] + u * u * posB[2],
  ];
  const target = lerp3(tgtA, tgtB, smoothstep(4.0, 16.5, t));
  target[0] -= settle;
  const posS = add(pos, sway(t, 0.008));
  const targetS = add(target, sway(t + 12, 0.01));
  // Focus lags the move slightly, giving a visible rack from numbers to traces.
  const rack = smoothstep(6.5, 15.5, t);
  const fNumbers = dist(posS, [1.53, 0.53, 0]);
  const fTraces = dist(posS, [1.0, 0.6, 0]);
  return {
    pos: posS,
    target: targetS,
    roll: mix(0.02, 0.05, move),
    fovY: (34 * Math.pow(7.6 / 34, move) * Math.PI) / 180,
    focusDist: mix(fNumbers, fTraces, rack),
    aperture: mix(70, 125, move),
    focusRange: 0.03,
  };
};
