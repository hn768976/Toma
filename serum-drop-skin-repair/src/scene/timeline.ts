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

const R0 = 0.52; // radius of the drop's round body
const TOUCH = 44; // frame at which the drop touches the skin

/**
 * Version 1 - reference camera: frontal view, gentle push-in while the drop
 * lands, then a slow pull-back / tilt-up that reveals the smooth skin and the
 * backdrop.
 */
const CAMERA_V1: CameraKey[] = [
  { f: 0, pos: [0.06, 2.0, 4.4], target: [0.0, 0.0, -1.68], fov: 30 },
  { f: 40, pos: [0.04, 2.05, 4.1], target: [0.0, 0.0, -0.97], fov: 30 },
  { f: 95, pos: [0.0, 2.0, 4.0], target: [0.0, 0.0, -1.1], fov: 30 },
  { f: 150, pos: [-0.03, 1.95, 4.1], target: [0.0, 0.0, -1.2], fov: 30 },
  { f: 230, pos: [-0.06, 1.76, 4.7], target: [0.0, 0.0, -0.55], fov: 30 },
  { f: 300, pos: [-0.08, 1.6, 5.2], target: [0.0, 0.0, -0.65], fov: 30 },
];

/**
 * Version 2 - alternative camera: a continuous orbiting crane shot. It starts
 * as a three-quarter view from the right, rises to a near top-down view while
 * the ring of light spreads (showing the radial healing wave), then sweeps
 * down to a low grazing angle on the left for the smooth-skin reveal.
 */
const CAMERA_V2: CameraKey[] = [
  { f: 0, pos: [3.3, 2.5, 3.5], target: [0.0, 0.55, 0.0], fov: 30 },
  { f: 60, pos: [2.3, 3.7, 3.9], target: [0.0, 0.3, 0.0], fov: 30 },
  { f: 125, pos: [0.4, 5.6, 3.1], target: [0.0, 0.0, 0.0], fov: 31 },
  { f: 190, pos: [-2.2, 5.4, 3.0], target: [0.0, 0.0, -0.1], fov: 32 },
  { f: 250, pos: [-4.2, 3.2, 3.7], target: [0.0, 0.0, -0.5], fov: 31 },
  { f: 300, pos: [-5.1, 1.75, 4.4], target: [0.0, 0.0, -1.0], fov: 30 },
];

const CAMERAS: Record<Variant, CameraKey[]> = { v1: CAMERA_V1, v2: CAMERA_V2 };

export const sceneUniforms = (frame: number, variant: Variant) => {
  const cam = sampleCamera(CAMERAS[variant], frame);

  // --- drop shape: spherical cap (contact radius a, height hc) + melting tip
  const hover = curve([[0, 0.11], [TOUCH, 0.0]], frame) * (frame < TOUCH ? 1 : 0);
  const a = curve(
    [[TOUCH, 0.05], [60, 0.4], [75, 0.72], [100, 0.82], [115, 0.78], [130, 0.68], [150, 0.6]],
    frame,
  );
  const hc = curve(
    [[TOUCH, 2 * R0], [60, 0.95], [75, 0.66], [100, 0.42], [115, 0.16], [130, 0.05], [150, 0.012]],
    frame,
  );
  const capR = (a * a + hc * hc) / (2 * hc);
  const capY = hc - capR + hover;
  const tipR = curve([[TOUCH, 0.035], [62, 0.08], [75, 0.2], [88, 0.22]], frame);
  const tipY =
    curve([[TOUCH, 2.8 * R0 - 0.035], [60, 1.3], [75, 0.9], [84, 0.55], [90, 0.32], [96, 0.1], [104, -0.4]], frame) +
    hover;
  const opacity = curve(
    [[0, 0.93], [55, 0.92], [75, 0.84], [100, 0.55], [115, 0.27], [132, 0.08]],
    frame,
  );
  const visible = 1 - ramp(frame, 128, 150);

  // --- skin response under the drop
  const contactShadow = curve([[0, 0.3], [TOUCH, 0.26], [75, 0.12], [112, 0.0]], frame);
  const contactGlow = curve([[38, 0.0], [50, 0.8], [95, 0.55], [146, 0.0]], frame);
  const ring = curve([[108, 0.0], [130, 1.0], [154, 0.0]], frame);

  const rippleAmp = curve([[54, 0.0], [70, 0.017], [100, 0.013], [142, 0.0]], frame);
  const ripplePhase = 0.7 * (frame - 54);
  const rippleRadius = Math.min(1.2 + 0.085 * Math.max(frame - 54, 0), 7.5);

  // --- light front and healing front (world units from the drop)
  const glowR = curve(
    [[62, 0.0], [66, 0.9], [90, 1.8], [110, 2.6], [130, 3.4], [150, 4.2], [180, 5.0], [210, 5.4], [300, 5.6]],
    frame,
  );
  const healR = curve(
    [[150, 0.0], [175, 0.9], [200, 2.1], [225, 3.5], [250, 5.0], [275, 6.8], [300, 9.0]],
    frame,
  );

  const focusPoint: Vec3 = [0, curve([[0, 0.7], [70, 0.4], [120, 0.0]], frame), 0];

  return {
    uCamPos: cam.pos as number[],
    uCamMat: cameraMatrix(cam),
    uTanHalfFov: Math.tan((cam.fov * Math.PI) / 360),
    uDropA: [capR, capY, tipY, tipR],
    uDropB: [opacity, curve([[TOUCH, 0.2], [70, 0.5], [100, 0.5]], frame), visible, frame < TOUCH ? R0 : a],
    uGround: [contactShadow, contactGlow, ring, 0],
    uRipple: [rippleAmp, ripplePhase, rippleRadius, 0],
    uGlowR: glowR,
    uHealR: healR,
    uGlowI: ramp(frame, 62, 76),
    uGlobalHeal: ramp(frame, 258, 296),
    uTime: frame / FPS,
    uFocus: distance(cam.pos, focusPoint),
    uAperture: 2.6,
  };
};
