import { MAX_DROPS } from "../shaders/scene";
import {
  CameraKey,
  cameraMatrix,
  clamp01,
  curve,
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
  /** optional keyframed height of the drop's underside above the skin */
  gap?: [number, number][];
};

// Positions and timings follow the reference: three drops early, three later.
const DROPS: Drop[] = [
  // hero drop: falls quickly at first, then settles onto the skin in slow motion
  { x: 0.05, z: 0.75, land: 38, v: 0, a: 0, sink: 56, flat: 20, fade: 18, gap: [[0, 0.22], [22, 0.04], [38, 0]] },
  { x: -1.6, z: -0.2, land: 52, v: 0.02, a: 0.0002, sink: 46, flat: 22, fade: 24 },
  { x: 1.25, z: -1.0, land: 57, v: 0.022, a: 0.0002, sink: 42, flat: 22, fade: 24 },
  { x: 1.2, z: 1.65, land: 112, v: 0, a: 0, sink: 36, flat: 30, fade: 18, gap: [[50, 3.4], [60, 2.8], [78, 1.9], [96, 1.0], [112, 0]] },
  { x: -2.25, z: 0.7, land: 103, v: 0, a: 0, sink: 40, flat: 24, fade: 20, gap: [[40, 4.2], [56, 2.4], [80, 1.1], [103, 0]] },
  { x: 2.4, z: -1.7, land: 150, v: 0, a: 0, sink: 24, flat: 20, fade: 14, gap: [[0, 6.0], [100, 3.6], [122, 2.2], [150, 0]] },
];

// Fast crane-up / tilt-down while the first drops land, a slow push while
// they are absorbed, then a rolling pull-back that reveals the slab edge.
const CAMERA: CameraKey[] = [
  { f: 0, pos: [0.15, 1.25, 5.3], target: [0.0, 0.0, 0.65], roll: 0, fov: 30 },
  { f: 12, pos: [0.14, 1.45, 5.2], target: [0.0, 0.0, 0.5], roll: 0, fov: 30 },
  { f: 25, pos: [0.13, 1.72, 5.05], target: [0.0, 0.0, -0.2], roll: 0, fov: 30 },
  { f: 48, pos: [0.1, 3.75, 3.78], target: [0.0, 0.0, -0.38], roll: 0, fov: 30 },
  { f: 105, pos: [0.15, 3.85, 3.95], target: [0.02, 0.0, 0.7], roll: 0.3, fov: 30 },
  { f: 128, pos: [0.22, 4.1, 4.5], target: [0.05, 0.0, 0.9], roll: 1.2, fov: 30 },
  { f: 165, pos: [0.6, 5.3, 7.2], target: [0.1, 0.0, 1.1], roll: 3.8, fov: 30 },
  { f: 192, pos: [0.85, 6.3, 8.4], target: [0.12, 0.0, 1.3], roll: 5.6, fov: 30 },
  { f: 226, pos: [1.0, 6.95, 9.15], target: [0.12, 0.0, 1.38], roll: 6.5, fov: 30 },
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
    const y = d.gap
      ? r + curve(d.gap, frame)
      : r + d.v * -tau + 0.5 * d.a * tau * tau;
    return {
      center: [d.x, y, d.z],
      rx: r,
      ry: r,
      strength: 1,
      healRadius: 0,
      shadow: 1,
      glow: 0.55 * ramp(tau, -10, 0) * 0.3,
      ring: 0,
      sheen: 0,
    };
  }
  const u = smooth(tau / d.sink);
  const w = smooth((tau - d.sink) / d.flat);
  const z = smooth((tau - d.sink - d.flat) / d.fade);
  const cy = r * (1 - u);
  const ry = r * lerp(lerp(1, 0.12, w), 0.02, z);
  const rx = r * lerp(lerp(1, 0.94, w), 0.4, z);
  return {
    center: [d.x, cy, d.z],
    rx,
    ry,
    strength: 1 - z,
    healRadius: 3.6 * smooth((tau - 6) / 115),
    shadow: 1 - u,
    glow: 0.55 * (0.3 + 0.7 * ramp(tau, 0, 14)) * (1 - 0.78 * w) * (1 - z),
    ring: 0.32 * Math.sin(Math.PI * clamp01(z)) + 0.26 * w * (1 - z),
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
  const k = ramp(frame, 46, 100);
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
    uGlobalHeal: clamp01((frame - 112) / (206 - 112)),
    uWetTone: ramp(frame, 84, 176),
    uFocus: distance(cam.pos, focusPoint),
    uAperture: lerp(1.5, 4.0, ramp(frame, 40, 230)),
  };
};
