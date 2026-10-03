/**
 * Every camera / body / counter value is a pure function of the frame number.
 * Tables are computed once at module level (deterministic), never accumulated
 * across rendered frames.
 */
import * as THREE from "three";

export const FRAMES = 600;
export const FOV = 45; // vertical, degrees

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
export const smooth = (a: number, b: number, x: number) => {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};
const smoother = (a: number, b: number, x: number) => {
  const t = clamp01((x - a) / (b - a));
  return t * t * t * (t * (t * 6 - 15) + 10);
};
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/* ---------- near-field travel speed (world units / frame) ---------- */
// 0–90 slow pull back, 60–180 accelerate, 160–330 warp, 310–420 decelerate,
// 400–600 gentle drift.
const L = Math.log;
export const fieldSpeed = (f: number) =>
  Math.exp(
    L(0.25) +
      (L(6) - L(0.25)) * smooth(50, 180, f) +
      (L(45) - L(6)) * smooth(160, 245, f) -
      (L(45) - L(0.6)) * smooth(305, 420, f) -
      (L(0.6) - L(0.3)) * smooth(420, 600, f),
  );

/** 0..1: how deep into the warp we are (from the speed, log scale). */
export const warpAmount = (f: number) => smooth(L(4), L(40), L(fieldSpeed(f)));

// cumulative travel, integrated once with fine sub-steps (module level)
const SUB = 16;
const TRAVEL: number[] = (() => {
  const t = [0];
  let acc = 0;
  for (let i = 0; i < FRAMES + 1; i++) {
    for (let s = 0; s < SUB; s++) acc += fieldSpeed(i + (s + 0.5) / SUB) / SUB;
    t.push(acc);
  }
  return t;
})();
export const travel = (f: number) => {
  const i = Math.max(0, Math.min(FRAMES, Math.floor(f)));
  return lerp(TRAVEL[i], TRAVEL[i + 1], f - i);
};

/** Distance counter: 0.00 → 4.24 light-years, eased with the travel; holds from ~frame 425. */
const ARRIVE_FRAME = 425;
export const lightYears = (f: number) => 4.24 * clamp01(travel(f) / travel(ARRIVE_FRAME));

/* ---------- camera orientation ---------- */
// Starts looking back at the Sun (+z), turns around to face the direction of
// travel (-z) while accelerating, then drifts gently on arrival.
export const cameraYaw = (f: number) =>
  Math.PI * smoother(105, 205, f) + 0.07 * smooth(400, 600, f) - 0.04;
export const cameraPitch = (f: number) =>
  0.03 * (1 - smooth(105, 205, f)) - 0.035 * smooth(380, 600, f);
export const cameraRoll = (f: number) => 0.06 * smooth(330, 600, f) - 0.03;

export const cameraQuaternion = (f: number) =>
  new THREE.Quaternion().setFromEuler(
    // yaw about +y; base orientation looks down -z, so add PI to look at +z first
    new THREE.Euler(cameraPitch(f), cameraYaw(f) + Math.PI, cameraRoll(f), "YXZ"),
  );

/* ---------- bodies (camera at the origin, positions camera-relative) ---------- */
export const SUN_RADIUS = 1;
const SUN_START = 11.4; // Sun disc ≈ 20% of frame height at FOV 45
/** Sun distance from the camera: grows smoothly in log space. */
export const sunDistance = (f: number) =>
  Math.exp(L(SUN_START) + (L(4e5) - L(SUN_START)) * Math.pow(clamp01(f / 300), 2.1));

/** Distance to the Alpha Centauri system ahead of the camera. */
export const acDistance = (f: number) => {
  const far = 2e6;
  const near = 17.5;
  // log-space approach, strongly eased out, then a slow continuous drift in
  const a = smooth(200, 425, f);
  const approach = 1 - Math.pow(1 - a, 3);
  return Math.exp(lerp(L(far), L(near), approach)) - 4 * smooth(380, 600, f);
};

export type Body = {
  name: string;
  /** camera-relative world position */
  pos: THREE.Vector3;
  radius: number;
  core: [number, number, number];
  glow: [number, number, number];
  glowSize: number; // glow radius in body radii
  intensity: number;
  granulation: number;
};

// Alpha Centauri system layout, relative to the system centre.
const AC_A = new THREE.Vector3(-1.4, 1.2, 0);
const AC_B = new THREE.Vector3(1.9, -0.6, 0.8);
const PROXIMA = new THREE.Vector3(1.75, -2.9, 1.6);

export const bodiesAt = (f: number): Body[] => {
  // Sun sits at world +z ahead of the starting view, slightly upper left.
  const ds = sunDistance(f);
  const sun = new THREE.Vector3(0.1, -1.0, ds);
  const dac = acDistance(f);
  const c = new THREE.Vector3(0, 0, -dac);
  return [
    {
      name: "Sun",
      pos: sun,
      radius: SUN_RADIUS,
      core: [1.0, 0.95, 0.84],
      glow: [1.0, 0.66, 0.38],
      glowSize: 0.9,
      intensity: 1.0,
      granulation: 1,
    },
    {
      name: "Alpha Centauri A",
      pos: c.clone().add(AC_A),
      radius: 0.4,
      core: [1.0, 0.96, 0.84],
      glow: [1.0, 0.7, 0.48],
      glowSize: 1.1,
      intensity: 1.0,
      granulation: 0.4,
    },
    {
      name: "Alpha Centauri B",
      pos: c.clone().add(AC_B),
      radius: 0.34,
      core: [1.0, 0.9, 0.74],
      glow: [1.0, 0.66, 0.44],
      glowSize: 1.1,
      intensity: 0.92,
      granulation: 0.4,
    },
    {
      name: "Proxima Centauri",
      pos: c.clone().add(PROXIMA),
      radius: 0.07,
      core: [0.95, 0.12, 0.06],
      glow: [0.8, 0.08, 0.04],
      glowSize: 0.6,
      intensity: 0.3,
      granulation: 0,
    },
  ];
};

/* ---------- projection shared by the GL pass and the HTML labels ---------- */
export const makeCamera = (f: number, aspect: number) => {
  const cam = new THREE.PerspectiveCamera(FOV, aspect, 0.05, 2e7);
  cam.position.set(0, 0, 0);
  cam.quaternion.copy(cameraQuaternion(f));
  cam.updateMatrixWorld(true);
  cam.updateProjectionMatrix();
  return cam;
};

/** Project a camera-relative point: returns pixel coords (origin top-left) or null if behind. */
export const projectToPx = (
  cam: THREE.PerspectiveCamera,
  p: THREE.Vector3,
  width: number,
  height: number,
) => {
  const v = p.clone().applyMatrix4(cam.matrixWorldInverse);
  if (v.z > -cam.near) return null;
  const ndc = v.clone().applyMatrix4(cam.projectionMatrix);
  return {
    x: (ndc.x * 0.5 + 0.5) * width,
    y: (1 - (ndc.y * 0.5 + 0.5)) * height,
    depth: -v.z,
  };
};

/** Apparent radius in pixels of a sphere of radius r at distance d. */
export const pixelRadius = (r: number, d: number, height: number) =>
  (r / d) * (height / 2 / Math.tan(THREE.MathUtils.degToRad(FOV / 2)));
