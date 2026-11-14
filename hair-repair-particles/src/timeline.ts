import * as THREE from "three";
import { clamp01, easeInOutSine, lerp, ramp } from "./util";

export const FPS = 30;
export const DURATION_SECONDS = 9;
export const DURATION_FRAMES = FPS * DURATION_SECONDS; // 270
export const WIDTH = 3840;
export const HEIGHT = 2160;
export const FOV = 30;

/**
 * Hair centre line in world units. The final (wide) camera frames
 * x 0..17.78, y 0..10, so these read directly as "final frame" coordinates.
 */
export const HAIR_POINTS: [number, number][] = [
  [5.3, -9.5],
  [5.62, -7],
  [6.0, -4.5],
  [6.4, -2.2],
  [6.83, 0],
  [7.5, 2],
  [8.03, 3.8],
  [9.2, 6.1],
  [10.3, 7.7],
];

export const hairCurve = new THREE.CatmullRomCurve3(
  HAIR_POINTS.map(([x, y]) => new THREE.Vector3(x, y, 0)),
  false,
  "centripetal",
);
export const HAIR_LENGTH = hairCurve.getLength();

/** Hair radius at arc parameter u (0 = root end, 1 = tip). */
/** Arc distance from the tip to where the strand crosses y = 0. */
const D_SHAFT = (() => {
  for (let i = 0; i <= 2000; i++) {
    const u = i / 2000;
    if (hairCurve.getPointAt(u).y >= 0) return (1 - u) * HAIR_LENGTH;
  }
  return HAIR_LENGTH;
})();

/**
 * Hair radius at arc parameter u (0 = root end, 1 = tip): a fine, evenly
 * tapering shaft that thickens noticeably towards the root.
 */
export const hairRadius = (u: number) => {
  const d = (1 - u) * HAIR_LENGTH; // distance from the tip
  const shaft = 0.068 * Math.min(d, D_SHAFT) * (0.55 + 0.45 * clamp01(d / 2.5));
  const below = Math.max(0, d - D_SHAFT);
  // smooth blend into the thicker root section
  const root = 0.175 * below * (below / (below + 0.8));
  return shaft + root + 0.004;
};

/** Timing (seconds), measured from the reference clip. */
export const T = {
  ringEnter: 1.7, // ring of molecules enters the frame from below
  ringAtTip: 7.0,
  beadsOutStart: 6.2,
  beadsOutEnd: 7.25,
  flareDipStart: 6.7, // flare dips briefly as the ring leaves the tip…
  flareDipEnd: 7.1,
  flareOutStart: 7.5, // …flares up again, then dies
  flareOutEnd: 7.82,
  cameraStart: 1.5,
  cameraEnd: 8.2,
};

/** Arc parameter of the repair front (the ring) – constant speed. */
export const ringU = (t: number) => {
  const dEnter = 13.6; // distance from tip when it enters the frame
  const speed = dEnter / (T.ringAtTip - T.ringEnter);
  // the ring arrives a touch late, then settles into a constant speed
  const lag = t < 2.4 ? 0.06 * (2.4 - t) * (2.4 - t) : 0;
  const d = dEnter - speed * (t - lag - T.ringEnter);
  return clamp01(1 - d / HAIR_LENGTH);
};

/** 0..1 progress of the pull-back camera move. */
export const cameraProgress = (t: number) =>
  easeInOutSine(ramp(t, T.cameraStart, T.cameraEnd));

const camera = new THREE.PerspectiveCamera(FOV, WIDTH / HEIGHT, 0.1, 400);

const START_POS = new THREE.Vector3(6.0, -5.3, 10.0);
const START_TARGET = new THREE.Vector3(6.3, -2.8, 0);
const END_DIST = 5 / Math.tan(THREE.MathUtils.degToRad(FOV / 2));
const END_POS = new THREE.Vector3(8.89, 5, END_DIST);
const END_TARGET = new THREE.Vector3(8.89, 5, 0);
const MID_POS = new THREE.Vector3(6.2, -1.0, 12.0);

const bez = (a: number, b: number, c: number, p: number) =>
  (1 - p) * (1 - p) * a + 2 * (1 - p) * p * b + p * p * c;

/**
 * Close, low, upward-looking macro shot that follows the ring up the strand
 * while pulling back to a frontal wide shot – same move in both versions.
 */
export const getCamera = (t: number) => {
  const p = cameraProgress(t);
  // gentle handheld-free drift before the move starts
  const drift = t * 0.012;
  camera.position.set(
    bez(START_POS.x, MID_POS.x, END_POS.x, p) + drift * (1 - p),
    bez(START_POS.y, MID_POS.y, END_POS.y, p) - drift * 2 * (1 - p),
    bez(START_POS.z, MID_POS.z, END_POS.z, p) + drift * 2 * (1 - p),
  );
  const q = Math.pow(p, 0.62);
  camera.up.set(0, 1, 0);
  camera.lookAt(
    lerp(START_TARGET.x, END_TARGET.x, q),
    lerp(START_TARGET.y, END_TARGET.y, q),
    0,
  );
  camera.updateMatrixWorld(true);
  return camera;
};
