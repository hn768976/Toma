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
  [5.85, -9.5],
  [5.98, -7],
  [6.17, -4.5],
  [6.45, -2.2],
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
export const hairRadius = (u: number) => {
  const d = (1 - u) * HAIR_LENGTH; // distance from the tip
  return 0.074 * d * (0.55 + 0.45 * clamp01(d / 2.5)) + 0.004;
};

/** Timing (seconds), measured from the reference clip. */
export const T = {
  ringEnter: 1.7, // ring of molecules enters the frame from below
  ringAtTip: 7.0,
  beadsOutStart: 6.2,
  beadsOutEnd: 7.25,
  flareOutStart: 7.6,
  flareOutEnd: 8.5,
  cameraStart: 1.5,
  cameraEnd: 8.2,
};

/** Arc parameter of the repair front (the ring) – constant speed. */
export const ringU = (t: number) => {
  const dEnter = 13.6; // distance from tip when it enters the frame
  const speed = dEnter / (T.ringAtTip - T.ringEnter);
  const d = dEnter - speed * (t - T.ringEnter);
  return clamp01(1 - d / HAIR_LENGTH);
};

/** 0..1 progress of the pull-back camera move. */
export const cameraProgress = (t: number) =>
  easeInOutSine(ramp(t, T.cameraStart, T.cameraEnd));

const camera = new THREE.PerspectiveCamera(FOV, WIDTH / HEIGHT, 0.1, 400);

const START_POS = new THREE.Vector3(5.9, -9.6, 7.4);
const START_TARGET = new THREE.Vector3(6.75, -1.6, 0);
const END_DIST = 5 / Math.tan(THREE.MathUtils.degToRad(FOV / 2));
const END_POS = new THREE.Vector3(8.89, 5, END_DIST);
const END_TARGET = new THREE.Vector3(8.89, 5, 0);
const MID_POS = new THREE.Vector3(6.0, -1.5, 16.5);

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
