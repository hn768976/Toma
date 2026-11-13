import { MAX_DROPS } from "../shaders/scene";
import {
  CameraKey,
  cameraMatrix,
  clamp01,
  distance,
  lerp,
  ramp,
  sampleCamera,
  smooth,
  Vec3,
} from "./math";

export const FPS = 30;
/** 8.3667 s @ 30 fps - identical to the reference clip (251 frames) */
export const DURATION_IN_FRAMES = 251;

const R = 0.45; // drop radius (world units)

type Drop = {
  x: number;
  z: number;
  /** frame at which the drop touches the skin */
  land: number;
  /** fall speed at touch-down (units / frame) and gentle acceleration */
  v: number;
  a: number;
  sink: number; // frames to sink to a half-dome
  flat: number; // frames to flatten into a lens
  fade: number; // frames for the lens to be absorbed
  r?: number;
};

// Positions and timings follow the reference: three drops early, three later.
const DROPS: Drop[] = [
  { x: 0.05, z: 0.75, land: 36, v: 0.0072, a: 0.00004, sink: 56, flat: 20, fade: 18 },
  { x: -1.95, z: -0.95, land: 52, v: 0.016, a: 0.0002, sink: 46, flat: 22, fade: 24 },
  { x: 1.7, z: -2.15, land: 48, v: 0.021, a: 0.0002, sink: 48, flat: 22, fade: 24 },
  { x: 1.5, z: 1.75, land: 118, v: 0.017, a: 0.00012, sink: 32, flat: 28, fade: 20, r: 0.47 },
  { x: -2.35, z: 0.55, land: 100, v: 0.019, a: 0.00018, sink: 40, flat: 22, fade: 22 },
  { x: 2.75, z: -2.5, land: 142, v: 0.02, a: 0.0002, sink: 24, flat: 18, fade: 24 },
];

const CAMERA: CameraKey[] = [
  { f: 0, pos: [0.15, 1.25, 5.3], target: [0.0, 0.0, 0.65], roll: 0, fov: 30 },
  { f: 32, pos: [0.12, 1.52, 5.15], target: [0.0, 0.0, 0.62], roll: 0, fov: 30 },
  { f: 70, pos: [0.1, 1.85, 5.0], target: [0.0, 0.0, 0.6], roll: 0, fov: 30 },
  { f: 128, pos: [0.2, 2.5, 5.0], target: [0.05, 0.0, 0.75], roll: 0.6, fov: 30 },
  { f: 178, pos: [0.6, 4.6, 6.9], target: [0.1, 0.0, 1.1], roll: 3.6, fov: 30 },
  { f: 226, pos: [0.95, 6.7, 8.95], target: [0.12, 0.0, 1.36], roll: 6.2, fov: 30 },
  { f: 250, pos: [1.05, 7.1, 9.3], target: [0.12, 0.0, 1.4], roll: 6.8, fov: 30 },
];

export type DropState = {
  center: Vec3;
  rx: number;
  ry: number;
  strength: number;
  healRadius: number;
  shadow: number;
  glow: number;
  ring: number;
  sheen: number;
};

export const dropState = (d: Drop, frame: number): DropState => {
  const r = d.r ?? R;
  const tau = frame - d.land;
  if (tau < 0) {
    const y = r + d.v * -tau + 0.5 * d.a * tau * tau;
    return {
      center: [d.x, y, d.z],
      rx: r,
      ry: r,
      strength: 1,
      healRadius: 0,
      shadow: 1,
      glow: 0.26 * ramp(tau, -10, 0) * 0.3,
      ring: 0,
      sheen: 0,
    };
  }
  const u = smooth(tau / d.sink);
  const w = smooth((tau - d.sink) / d.flat);
  const z = smooth((tau - d.sink - d.flat) / d.fade);
  // tiny elastic settle on touch-down
  const settle = 1 - 0.05 * Math.exp(-tau / 5) * Math.cos(tau / 2.6);
  const cy = r * (1 - u) * settle;
  const ry = r * lerp(lerp(1, 0.12, w), 0.02, z) * settle;
  const rx = r * lerp(lerp(1, 0.94, w), 0.4, z) * (2 - settle);
  return {
    center: [d.x, cy, d.z],
    rx,
    ry,
    strength: lerp(1, 0.8, w) * (1 - z),
    healRadius: 3.6 * smooth((tau - 6) / 115),
    shadow: 1 - u,
    glow: 0.26 * (0.3 + 0.7 * ramp(tau, 0, 14)) * (1 - z),
    ring: 0.32 * Math.sin(Math.PI * clamp01(z)) + 0.10 * w * (1 - z),
    sheen: ramp(tau, d.sink * 0.5, d.sink + d.flat + d.fade + 25),
  };
};

export const sceneUniforms = (frame: number) => {
  const cam = sampleCamera(CAMERA, frame);
  const a = new Float32Array(MAX_DROPS * 4);
  const b = new Float32Array(MAX_DROPS * 4);
  const c = new Float32Array(MAX_DROPS * 4);
  const states = DROPS.map((d) => dropState(d, frame));
  states.forEach((s, i) => {
    a.set([s.center[0], s.center[1], s.center[2], s.rx], i * 4);
    b.set([s.ry, s.strength, s.healRadius, s.shadow], i * 4);
    c.set([s.glow, s.ring, s.sheen, 0], i * 4);
  });

  // focus: first hero drop, then the point the camera looks at
  const hero = states[0].center;
  const k = ramp(frame, 40, 110);
  const focusPoint: Vec3 = [
    lerp(hero[0], cam.target[0], k),
    lerp(hero[1], cam.target[1], k),
    lerp(hero[2], cam.target[2], k),
  ];

  return {
    uCamPos: cam.pos as number[],
    uCamMat: cameraMatrix(cam),
    uTanHalfFov: Math.tan((cam.fov * Math.PI) / 360),
    uSphA: a,
    uSphB: b,
    uSphC: c,
    uGlobalHeal: ramp(frame, 160, 220),
    uFocus: distance(cam.pos, focusPoint),
    uAperture: lerp(3.0, 4.2, ramp(frame, 150, 250)),
  };
};
