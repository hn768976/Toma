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
const TOUCH = 38; // frame at which the drop touches the skin

/**
 * Version 1 - reference camera: frontal view, gentle push-in while the drop
 * lands, then a slow pull-back / tilt-up that reveals the smooth skin and the
 * backdrop.
 */
const CAMERA_V1: CameraKey[] = [
  // the camera stays put and tilts down, following the falling drop
  { f: 0, pos: [0.05, 2.96, 3.8], target: [0.0, 0.0, -5.2], fov: 30 },
  { f: 13, pos: [0.05, 2.96, 3.8], target: [0.0, 0.0, -3.52], fov: 30 },
  { f: 26, pos: [0.05, 2.96, 3.8], target: [0.0, 0.0, -2.0], fov: 30 },
  { f: 39, pos: [0.05, 2.96, 3.8], target: [0.0, 0.0, -0.94], fov: 30 },
  { f: 44, pos: [0.05, 2.96, 3.8], target: [0.0, 0.0, -0.92], fov: 30 },
  { f: 57, pos: [0.04, 2.96, 3.82], target: [0.0, 0.0, -0.94], fov: 30 },
  // slow, continuous pull-back and tilt-up until the last frame
  { f: 175, pos: [-0.13, 2.72, 5.1], target: [0.0, 0.0, -1.85], fov: 30 },
  { f: 300, pos: [-0.3, 2.5, 6.4], target: [0.0, 0.0, -2.6], fov: 30 },
];

/**
 * Version 2 - alternative camera: a continuous orbiting crane shot. It starts
 * as a three-quarter view from the right, rises to a near top-down view while
 * the ring of light spreads (showing the radial healing wave), then sweeps
 * down to a low grazing angle on the left for the smooth-skin reveal.
 */
const CAMERA_V2: CameraKey[] = [
  // low side view looking slightly up at the falling drop
  { f: 0, pos: [3.3, 1.25, 2.3], target: [0.0, 1.5, 0.0], fov: 30 },
  { f: 38, pos: [2.6, 2.3, 3.0], target: [0.0, 0.55, 0.0], fov: 30 },
  { f: 60, pos: [1.9, 3.2, 3.3], target: [0.0, 0.3, 0.0], fov: 30 },
  { f: 125, pos: [0.35, 5.0, 2.8], target: [0.0, 0.0, 0.0], fov: 31 },
  { f: 190, pos: [-2.1, 5.0, 2.9], target: [0.0, 0.0, -0.1], fov: 32 },
  { f: 250, pos: [-4.2, 3.2, 3.7], target: [0.0, 0.0, -0.5], fov: 31 },
  { f: 300, pos: [-5.1, 1.75, 4.4], target: [0.0, 0.0, -1.0], fov: 30 },
];

const CAMERAS: Record<Variant, CameraKey[]> = { v1: CAMERA_V1, v2: CAMERA_V2 };

export const sceneUniforms = (frame: number, variant: Variant) => {
  const cam = sampleCamera(CAMERAS[variant], frame);

  // --- drop: a teardrop falling through the frame, then one smooth gumdrop
  // that relaxes into a dome, a lens and finally a shrinking ring
  const gap = curve([[0, 1.2], [13, 0.88], [26, 0.42], [TOUCH, 0.0]], frame);
  const tipR = 0.022;
  const bodyY = R0 + gap;
  const tipY = 2.8 * R0 - tipR + gap;
  const gumA = curve(
    [[TOUCH, 0.5], [50, 0.6], [56, 0.66], [70, 0.7], [84, 0.72], [100, 0.72], [110, 0.62], [118, 0.5], [120, 0.41], [132, 0.23], [136, 0.2]],
    frame,
  );
  const gumH = curve(
    [[TOUCH, 1.36], [44, 1.22], [50, 0.95], [56, 0.8], [70, 0.62], [84, 0.46], [100, 0.3], [110, 0.16], [118, 0.07], [124, 0.035], [136, 0.01]],
    frame,
  );
  const gumN = curve([[TOUCH, 1.25], [50, 1.35], [56, 1.45], [70, 1.6], [84, 1.85], [96, 2.0]], frame);
  const morph = ramp(frame, TOUCH, TOUCH + 13);
  // footprint on the skin (light pool, ring, repaired disc), always continuous
  const a = curve(
    [[0, 0.3], [TOUCH, 0.42], [50, 0.6], [56, 0.66], [70, 0.7], [84, 0.72], [100, 0.72], [110, 0.62], [118, 0.5], [120, 0.41], [132, 0.23], [136, 0.2]],
    frame,
  );
  const opacity = curve(
    [[0, 0.95], [TOUCH, 0.95], [50, 0.84], [60, 0.68], [70, 0.6], [84, 0.46], [100, 0.3], [118, 0.12], [130, 0.04]],
    frame,
  );
  const visible = 1 - ramp(frame, 128, 137);

  // --- skin response under the drop: a pool of light, then a shrinking ring
  const contactShadow = curve([[0, 0.0], [TOUCH, 0.04], [70, 0.0]], frame);
  const contactGlow = curve([[0, 0.12], [25, 0.3], [TOUCH, 0.6], [95, 0.45], [137, 0.0]], frame);
  const ring = curve([[52, 0.0], [70, 0.45], [108, 0.6], [120, 1.0], [132, 0.8], [137, 0.0]], frame);
  const underHeal = ramp(frame, 58, 104);
  // footprint that keeps the repaired disc once the drop has been absorbed
  const underRadius = curve([[TOUCH, 0.42], [56, 0.66], [84, 0.72], [300, 0.72]], frame);

  const rippleAmp = curve([[45, 0.0], [57, 0.04], [92, 0.032], [114, 0.0]], frame);
  const ripplePhase = 0.4 * (frame - 45);
  const rippleRadius = Math.min(1.2 + 0.055 * Math.max(frame - 45, 0), 3.6);

  // --- light front and healing front (world units from the drop)
  const glowR = curve(
    [[60, 0.45], [80, 0.85], [100, 1.45], [120, 2.3], [150, 4.0], [180, 5.2], [300, 5.6]],
    frame,
  );
  const healR = curve(
    [[150, 0.0], [175, 0.8], [200, 1.6], [225, 2.5], [250, 3.5], [268, 4.6], [282, 6.4], [300, 9.5]],
    frame,
  );

  const focusPoint: Vec3 = [0, curve([[0, 1.6], [TOUCH, 0.7], [70, 0.4], [120, 0.0]], frame), 0];

  return {
    uCamPos: cam.pos as number[],
    uCamMat: cameraMatrix(cam),
    uTanHalfFov: Math.tan((cam.fov * Math.PI) / 360),
    uDropA: [R0, bodyY, tipY, tipR],
    uGum: [gumA, gumH, gumN, morph],
    uDropB: [opacity, 0, visible, a],
    uGround: [contactShadow, contactGlow, ring, underRadius],
    uUnderHeal: underHeal,
    uToneGlobal: ramp(frame, 150, 290),
    uFrontBias: curve([[60, 0.5], [84, 0.25], [150, 0.15]], frame),
    uRipple: [rippleAmp, ripplePhase, rippleRadius, a],
    uGlowR: glowR,
    uHealR: healR,
    uGlowI: ramp(frame, 60, 98),
    uGlobalHeal: ramp(frame, 272, 292),
    uTime: frame / FPS,
    // V1 frames the far edge of the skin exactly like the reference; the
    // orbiting V2 camera sees an endless surface with a level horizon
    uFarEdge: variant === "v1" ? -19 : -600,
    uFocus: distance(cam.pos, focusPoint),
    uAperture: 2.5,
  };
};
