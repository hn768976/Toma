import { Euler, Matrix4, Object3D, Quaternion, Vector3 } from "three";

/**
 * Everything on screen is a pure function of the frame number.
 * All periodic terms use whole-number frequencies over LOOP frames, so
 * frame LOOP reproduces frame 0 exactly.
 */
export const FPS = 30;
export const LOOP = 600; // 20 s
export const TAU = Math.PI * 2;
export const DEG = Math.PI / 180;

/** Loop phase in [0, 1): t = frame / 600 (deliberately NOT reduced mod 600). */
export const phase = (frame: number) => frame / LOOP;

/** Positive modulo. */
export const wrap = (x: number, l: number) => ((x % l) + l) % l;

// ---------------------------------------------------------------- units: cm

export const CARD_W = 8.56;
export const CARD_H = 5.398;
export const CARD_T = 0.08;
export const CARD_CORNER = 0.318;

/** Lens: 58 mm focal length on a 36 mm-wide (full-frame) gate. */
export const FOCAL_MM = 58;
export const FILM_GAUGE_MM = 36;
export const ASPECT = 16 / 9;
export const HFOV = 2 * Math.atan(FILM_GAUGE_MM / 2 / FOCAL_MM);
export const VFOV = 2 * Math.atan(Math.tan(HFOV / 2) / ASPECT);
export const VFOV_DEG = VFOV / DEG;

/** Card should fill ~37.5% of frame width when square-on. */
export const CARD_FRAME_FRACTION = 0.375;
export const CAM_DIST = CARD_W / (CARD_FRAME_FRACTION * 2 * Math.tan(HFOV / 2));
/** Camera sits a little below the card and looks slightly up. */
export const CAM_Y = -4.3;
export const CAM_PITCH = Math.atan(-CAM_Y / CAM_DIST);
export const NEAR = 2;
export const FAR = 1200;

/** Base (frame-0-independent) camera position, used for track sizing. */
export const CAM_BASE = new Vector3(0, CAM_Y, CAM_DIST);

export type CameraPose = { position: Vector3; target: Vector3 };

/** Slow closed-path drift: a few degrees of orbit + a small height change. */
export const cameraPose = (frame: number): CameraPose => {
  const t = phase(frame);
  const az =
    2.6 * DEG * Math.sin(TAU * 1 * t + 0.4) +
    0.9 * DEG * Math.sin(TAU * 2 * t + 1.7);
  const y =
    CAM_Y + 0.85 * Math.sin(TAU * 1 * t + 2.1) + 0.25 * Math.sin(TAU * 3 * t + 0.3);
  const dist = CAM_DIST + 0.6 * Math.sin(TAU * 1 * t + 4.0);
  return {
    position: new Vector3(dist * Math.sin(az), y, dist * Math.cos(az)),
    target: new Vector3(0, 0.12 * Math.sin(TAU * 2 * t + 0.9), 0),
  };
};

// ------------------------------------------------------------------- card

/** Card faces the base camera position; tilt is layered on top of that. */
const cardBaseQuat = (() => {
  const o = new Object3D();
  o.lookAt(CAM_BASE); // +z of the card points at the camera
  return o.quaternion.clone();
})();

export type CardPose = { position: Vector3; quaternion: Quaternion };

/** Tilt amplitudes chosen so the card never turns more than ~25 deg away. */
export const cardPose = (frame: number): CardPose => {
  const t = phase(frame);
  const rx =
    0.19 * Math.sin(TAU * 1 * t + 0.6) + 0.06 * Math.sin(TAU * 3 * t + 2.2) + 0.03;
  const ry =
    0.25 * Math.sin(TAU * 1 * t + 2.9) + 0.07 * Math.sin(TAU * 2 * t + 0.4);
  const rz =
    -0.05 + 0.07 * Math.sin(TAU * 2 * t + 1.1) + 0.03 * Math.sin(TAU * 3 * t + 4.1);
  const tilt = new Quaternion().setFromEuler(new Euler(rx, ry, rz, "YXZ"));
  const q = cardBaseQuat.clone().multiply(tilt);
  const pos = new Vector3(
    0.18 * Math.sin(TAU * 1 * t + 1.9),
    0.3 * Math.sin(TAU * 2 * t + 0.2) + 0.1 * Math.sin(TAU * 1 * t + 3.3),
    0.25 * Math.sin(TAU * 1 * t + 5.1),
  );
  return { position: pos, quaternion: q };
};

/** Angle (deg) between the card's front normal and the direction to camera. */
export const cardFacingAngle = (frame: number) => {
  const card = cardPose(frame);
  const cam = cameraPose(frame);
  const n = new Vector3(0, 0, 1).applyQuaternion(card.quaternion);
  const toCam = cam.position.clone().sub(card.position).normalize();
  return Math.acos(Math.min(1, n.dot(toCam))) / DEG;
};

// ----------------------------------------------------------------- tracks

/** Visible vertical extent (world y) of the base camera at a given depth. */
export const visibleYRange = (depth: number) => {
  const top = CAM_Y + depth * Math.tan(CAM_PITCH + VFOV / 2);
  const bottom = CAM_Y + depth * Math.tan(CAM_PITCH - VFOV / 2);
  return { top, bottom };
};

/** Half the visible width at a given depth (base camera). */
export const visibleHalfWidth = (depth: number) =>
  (depth * Math.tan(HFOV / 2)) / Math.cos(CAM_PITCH);

/** World units per output pixel at a depth, for a 1080-px-tall frame. */
export const worldPerPx1080 = (depth: number) =>
  (2 * depth * Math.tan(VFOV / 2)) / 1080;

/**
 * Vertical track for a falling object at `depth` (cm from the base camera).
 * Margin covers the object's own size, its defocus blur and the camera drift,
 * so the wrap from bottom to top always happens off-screen.
 */
export const makeTrack = (depth: number, boundRadius: number, blurPx1080: number) => {
  const { top, bottom } = visibleYRange(depth);
  const drift = 1.4 + 0.045 * depth;
  const margin = boundRadius * 1.1 + blurPx1080 * worldPerPx1080(depth) + drift;
  const yTop = top + margin;
  const yBottom = bottom - margin;
  return { yTop, length: yTop - yBottom };
};

/** y = top - wrap(y0 + k * L * t, L): falls its track exactly k times per loop. */
export const trackY = (yTop: number, length: number, y0: number, k: number, frame: number) =>
  yTop - wrap(y0 + k * length * phase(frame), length);

/** Whole-turn tumble: each axis turns n full times per loop. */
export const tumble = (
  turns: readonly [number, number, number],
  phases: readonly [number, number, number],
  frame: number,
  out: Euler,
) => {
  const t = phase(frame);
  out.set(
    TAU * (turns[0] * t + phases[0]),
    TAU * (turns[1] * t + phases[1]),
    TAU * (turns[2] * t + phases[2]),
    "XYZ",
  );
  return out;
};

export const _m4 = new Matrix4();
