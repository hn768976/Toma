import {
  CameraKey,
  cameraMatrix,
  curve,
  distance,
  ramp,
  sampleCamera,
  Vec3,
} from "./math";

export const FPS = 30;
/** 10.0333 s @ 30 fps - identical to the reference clip (301 frames) */
export const DURATION_IN_FRAMES = 301;

export type Variant = "v1" | "v2";

const R0 = 0.5; // radius of the drop's round body
const TOUCH = 40; // frame at which the drop touches the skin

/**
 * Version 1 - reference camera: frontal view, gentle push-in while the drop
 * lands, then a slow pull-back / tilt-up that reveals the smooth skin and the
 * backdrop.
 */
const CAMERA_V1: CameraKey[] = [
  { f: 0, pos: [0.06, 1.9, 4.17], target: [0.0, 0.0, -1.61], fov: 30 },
  { f: 13, pos: [0.055, 2.15, 4.07], target: [0.0, 0.0, -0.85], fov: 30 },
  { f: 39, pos: [0.04, 2.75, 3.93], target: [0.0, 0.0, -0.65], fov: 30 },
  { f: 42, pos: [0.04, 2.75, 3.93], target: [0.0, 0.0, -0.65], fov: 30 },
  { f: 60, pos: [0.03, 2.72, 3.96], target: [0.0, 0.0, -0.65], fov: 30 },
  { f: 178, pos: [-0.14, 2.07, 4.4], target: [0.0, 0.0, -0.5], fov: 30 },
  { f: 285, pos: [-0.29, 1.52, 4.8], target: [0.0, 0.0, -0.54], fov: 30 },
  { f: 300, pos: [-0.3, 1.49, 4.82], target: [0.0, 0.0, -0.54], fov: 30 },
];

/**
 * Version 2 - alternative camera: a continuous orbiting crane shot. It starts
 * as a three-quarter view from the right, rises to a near top-down view while
 * the ring of light spreads (showing the radial healing wave), then sweeps
 * down to a low grazing angle on the left for the smooth-skin reveal.
 */
const CAMERA_V2: CameraKey[] = [
  { f: 0, pos: [2.7, 2.1, 2.9], target: [0.0, 0.55, 0.0], fov: 30 },
  { f: 60, pos: [1.9, 3.2, 3.3], target: [0.0, 0.3, 0.0], fov: 30 },
  { f: 125, pos: [0.35, 5.0, 2.8], target: [0.0, 0.0, 0.0], fov: 31 },
  { f: 190, pos: [-2.1, 5.0, 2.9], target: [0.0, 0.0, -0.1], fov: 32 },
  { f: 250, pos: [-4.2, 3.2, 3.7], target: [0.0, 0.0, -0.5], fov: 31 },
  { f: 300, pos: [-5.1, 1.75, 4.4], target: [0.0, 0.0, -1.0], fov: 30 },
];

const CAMERAS: Record<Variant, CameraKey[]> = { v1: CAMERA_V1, v2: CAMERA_V2 };

export const sceneUniforms = (frame: number, variant: Variant) => {
  const cam = sampleCamera(CAMERAS[variant], frame);

  // --- drop shape: spherical cap (contact radius a, height hc) + melting tip
  const hover = frame < TOUCH ? curve([[0, 0.05], [TOUCH, 0.0]], frame) : 0;
  const a = curve(
    [[TOUCH, 0.05], [42, 0.08], [46, 0.38], [52, 0.58], [64, 0.68], [76, 0.72], [104, 0.7], [116, 0.5], [120, 0.41], [132, 0.23], [138, 0.18]],
    frame,
  );
  const hc = curve(
    [[TOUCH, 2 * R0], [42, 0.985], [46, 0.72], [52, 0.54], [64, 0.45], [76, 0.4], [90, 0.35], [104, 0.26], [116, 0.1], [124, 0.04], [138, 0.01]],
    frame,
  );
  const capR = (a * a + hc * hc) / (2 * hc);
  const capY = hc - capR + hover;
  const tipR = curve([[TOUCH, 0.022], [42, 0.03], [46, 0.15], [52, 0.24], [64, 0.3], [80, 0.3]], frame);
  const tipY =
    curve(
      [[TOUCH, 2.8 * R0 - 0.022], [42, 1.34], [46, 0.92], [52, 0.6], [64, 0.4], [76, 0.3], [84, 0.2], [90, 0.05], [96, -0.2], [102, -0.5]],
      frame,
    ) + hover;
  const opacity = curve(
    [[0, 0.95], [TOUCH, 0.95], [56, 0.86], [76, 0.66], [90, 0.5], [104, 0.3], [118, 0.12], [130, 0.04]],
    frame,
  );
  const visible = 1 - ramp(frame, 128, 138);

  // --- skin response under the drop: a pool of light, then a shrinking ring
  const contactShadow = curve([[0, 0.07], [TOUCH, 0.05], [70, 0.0]], frame);
  const contactGlow = curve([[0, 0.45], [TOUCH, 0.6], [95, 0.45], [138, 0.0]], frame);
  const ring = curve([[52, 0.0], [70, 0.45], [108, 0.6], [120, 1.0], [132, 0.8], [139, 0.0]], frame);
  const underHeal = ramp(frame, 58, 104);
  // footprint that keeps the repaired disc once the drop has been absorbed
  const underRadius = curve([[TOUCH, 0.05], [52, 0.58], [76, 0.72], [300, 0.72]], frame);

  const rippleAmp = curve([[45, 0.0], [57, 0.04], [92, 0.032], [114, 0.0]], frame);
  const ripplePhase = 0.4 * (frame - 45);
  const rippleRadius = Math.min(1.2 + 0.055 * Math.max(frame - 45, 0), 3.6);

  // --- light front and healing front (world units from the drop)
  const glowR = curve(
    [[60, 0.45], [80, 0.85], [100, 1.45], [120, 2.3], [150, 4.0], [180, 5.2], [300, 5.6]],
    frame,
  );
  const healR = curve(
    [[138, 0.0], [150, 0.9], [166, 1.9], [200, 2.9], [220, 3.6], [240, 4.4], [260, 5.3], [278, 6.5], [300, 8.5]],
    frame,
  );

  const focusPoint: Vec3 = [0, curve([[0, 0.7], [70, 0.4], [120, 0.0]], frame), 0];

  return {
    uCamPos: cam.pos as number[],
    uCamMat: cameraMatrix(cam),
    uTanHalfFov: Math.tan((cam.fov * Math.PI) / 360),
    uDropA: [capR, capY, tipY, tipR],
    uDropB: [opacity, 0, visible, Math.max(a, R0 * (1 - ramp(frame, TOUCH, TOUCH + 12)))],
    uGround: [contactShadow, contactGlow, ring, underRadius],
    uUnderHeal: underHeal,
    uToneGlobal: ramp(frame, 120, 285),
    uFrontBias: curve([[60, 0.5], [84, 0.25], [150, 0.15]], frame),
    uRipple: [rippleAmp, ripplePhase, rippleRadius, a],
    uGlowR: glowR,
    uHealR: healR,
    uGlowI: ramp(frame, 60, 98),
    uGlobalHeal: ramp(frame, 266, 290),
    uTime: frame / FPS,
    uFocus: distance(cam.pos, focusPoint),
    uAperture: 2.5,
  };
};
