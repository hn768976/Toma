import * as THREE from "three";
import type { CameraKind } from "./config";

/**
 * All motion is a pure function of time (seconds) so that every frame is
 * deterministic and can be rendered in any order / in parallel.
 */

const TAU = Math.PI * 2;

const easeInOut = (x: number) => {
  const c = Math.min(1, Math.max(0, x));
  return c * c * (3 - 2 * c);
};


export type RingPose = {
  position: THREE.Vector3;
  quaternion: THREE.Quaternion;
};

/**
 * Smooth interpolation through [time, value] keyframes (cubic Hermite with
 * Catmull-Rom style tangents, zero slope at both ends).
 */
const keyframes = (t: number, keys: [number, number][]): number => {
  const n = keys.length;
  if (t <= keys[0][0]) return keys[0][1];
  if (t >= keys[n - 1][0]) return keys[n - 1][1];
  const slope = (i: number) =>
    i === 0 || i === n - 1 ? 0 : (keys[i + 1][1] - keys[i - 1][1]) / (keys[i + 1][0] - keys[i - 1][0]);
  for (let i = 0; i < n - 1; i++) {
    const [t0, v0] = keys[i];
    const [t1, v1] = keys[i + 1];
    if (t <= t1) {
      const h = t1 - t0;
      const u = (t - t0) / h;
      const u2 = u * u;
      const u3 = u2 * u;
      return (
        (2 * u3 - 3 * u2 + 1) * v0 +
        (u3 - 2 * u2 + u) * h * slope(i) +
        (-2 * u3 + 3 * u2) * v1 +
        (u3 - u2) * h * slope(i + 1)
      );
    }
  }
  return keys[n - 1][1];
};

/** Vertical bob measured from the references (screen px at 432p, every 0.5 s). */
const BOB_PX = [-5, -6, -4, 1, 3, 2, -1, -3, -3, 2, 6, 6, 3, 0, 0, 3, 3, 0, -3, -6, -6];
const BOB_KEYS: [number, number][] = BOB_PX.map((px, i) => [i * 0.5, -px / 68]);

/**
 * Floating motion measured from the references (both clips share it):
 * - drift: ~0.11 units to the right, mostly in the first 2.5 s, a plateau,
 *   then a second small step around 5-6 s;
 * - bob: irregular, ~3.5-4 s main cycle plus a faster component;
 * - roll: level for the first 5 s, then the float rocks so its left side dips
 *   (peak around 6.5-7 s) and slowly recovers towards the end.
 */
export const ringPose = (t: number): RingPose => {
  const drift = keyframes(t, [
    [0, -0.06],
    [1.0, -0.05],
    [2.5, -0.01],
    [4.5, 0.0],
    [5.5, 0.015],
    [6.4, 0.002],
    [7.3, -0.004],
    [9.5, 0.018],
    [10, 0.02],
  ]);
  const bob = keyframes(t, BOB_KEYS);
  const r = (k: number) => ROLL_BASE + ROLL_PEAK * k;
  const roll =
    keyframes(t, [
      [0, r(0)],
      [4.8, r(0.02)],
      [5.5, r(0.3)],
      [6.1, r(0.72)],
      [6.7, r(1.0)],
      [7.1, r(0.98)],
      [8.0, r(0.86)],
      [8.6, r(0.74)],
      [9.2, r(0.55)],
      [9.7, r(0.36)],
      [10, r(0.3)],
    ]) +
    0.008 * Math.sin((TAU * t) / 2.3);
  const pitch = 0.02 * Math.sin((TAU * t) / 3.7 + 0.8);
  const yaw = 0.07 * (t / 10) + 0.015 * Math.sin((TAU * t) / 6.5);

  const position = new THREE.Vector3(drift, RING_CENTER_Y + bob, 0.015 * Math.sin((TAU * t) / 7));
  const euler = new THREE.Euler(pitch, yaw, roll, "YXZ");
  const quaternion = new THREE.Quaternion().setFromEuler(euler);
  return { position, quaternion };
};

/** Resting height of the float's centre above the water surface. */
const RING_CENTER_Y = 0.15;
const ROLL_BASE = 0.045;
const ROLL_PEAK = 0.27;

export type CameraPose = {
  position: THREE.Vector3;
  target: THREE.Vector3;
  fov: number;
};

const sphericalCamera = (
  target: THREE.Vector3,
  elevationDeg: number,
  azimuthDeg: number,
  distance: number,
): THREE.Vector3 => {
  const el = THREE.MathUtils.degToRad(elevationDeg);
  const az = THREE.MathUtils.degToRad(azimuthDeg);
  return new THREE.Vector3(
    target.x + distance * Math.cos(el) * Math.sin(az),
    target.y + distance * Math.sin(el),
    target.z + distance * Math.cos(el) * Math.cos(az),
  );
};

/** Static camera matching the reference framing. */
const STATIC_TARGET = new THREE.Vector3(-1.246, -0.45, -0.224);
const STATIC_ELEVATION = 45.7;
const STATIC_AZIMUTH = 0;
const STATIC_DISTANCE = 14.66;
const STATIC_FOV = 18;

export const cameraPose = (kind: CameraKind, t: number): CameraPose => {
  if (kind === "static") {
    return {
      position: sphericalCamera(STATIC_TARGET, STATIC_ELEVATION, STATIC_AZIMUTH, STATIC_DISTANCE),
      target: STATIC_TARGET.clone(),
      fov: STATIC_FOV,
    };
  }

  // Version 2: a slow crane-down orbit. The camera begins almost overhead,
  // sweeps ~60 degrees around the float while descending to a low
  // three-quarter angle and pushing in.
  const p = easeInOut(t / 10);
  const elevation = THREE.MathUtils.lerp(78, 41, p);
  const azimuth = THREE.MathUtils.lerp(-38, 26, p);
  const distance = THREE.MathUtils.lerp(10.4, 8.2, p);
  const target = new THREE.Vector3(
    THREE.MathUtils.lerp(0.0, -0.15, p),
    -0.35,
    THREE.MathUtils.lerp(0.55, 0.85, p),
  );
  return {
    position: sphericalCamera(target, elevation, azimuth, distance),
    target,
    fov: 34,
  };
};
