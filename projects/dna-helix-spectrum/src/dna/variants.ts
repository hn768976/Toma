import { easeInOut, lerp } from "../engine/random";

export type Vec3 = [number, number, number];

export type CameraState = {
  position: Vec3;
  target: Vec3;
  up: Vec3;
  fov: number;
  focus: number; // focal distance (world units)
  aperture: number; // lens aperture diameter (world units)
};

export type DnaVariant = {
  id: string;
  seed: number;
  /** Hue palette for the base-pair rungs (0..1 hues, picked at random). */
  rungHues: number[];
  rungSaturation: number;
  backboneColor: Vec3;
  /** Helix spin (radians) at time t (seconds). */
  spin: (t: number) => number;
  camera: (t: number, duration: number) => CameraState;
  exposure: number;
  bloomNear: number;
  bloomWide: number;
};

const mix3 = (a: Vec3, b: Vec3, t: number): Vec3 => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];

/** Orbit-style camera rig around a point on the helix axis (axis runs along +X). */
export type Rig = {
  target: Vec3;
  dist: number;
  yaw: number; // degrees, angle between view direction and helix axis (90 = side-on)
  elev: number; // degrees, looking down
  roll: number; // degrees
  fov: number;
  focusOffset: number; // focus distance relative to dist
  aperture: number;
};

export const rigToCamera = (r: Rig): CameraState => {
  const y = (r.yaw * Math.PI) / 180;
  const e = (r.elev * Math.PI) / 180;
  const dir: Vec3 = [Math.cos(e) * Math.cos(y), -Math.sin(e), -Math.cos(e) * Math.sin(y)];
  const position: Vec3 = [r.target[0] - dir[0] * r.dist, r.target[1] - dir[1] * r.dist, r.target[2] - dir[2] * r.dist];
  // roll: rotate world-up about the view direction
  const rr = (r.roll * Math.PI) / 180;
  const right: Vec3 = [-dir[2], 0, dir[0]];
  const rl = Math.hypot(right[0], right[2]);
  const up: Vec3 = [
    Math.cos(rr) * 0 + Math.sin(rr) * (right[0] / rl),
    Math.cos(rr) * 1,
    Math.cos(rr) * 0 + Math.sin(rr) * (right[2] / rl),
  ];
  return { position, target: r.target, up, fov: r.fov, focus: r.dist + r.focusOffset, aperture: r.aperture };
};

const mixRig = (a: Rig, b: Rig, t: number): Rig => ({
  target: mix3(a.target, b.target, t),
  dist: lerp(a.dist, b.dist, t),
  yaw: lerp(a.yaw, b.yaw, t),
  elev: lerp(a.elev, b.elev, t),
  roll: lerp(a.roll, b.roll, t),
  fov: lerp(a.fov, b.fov, t),
  focusOffset: lerp(a.focusOffset, b.focusOffset, t),
  aperture: lerp(a.aperture, b.aperture, t),
});

const RAINBOW = [0.0, 0.05, 0.09, 0.14, 0.25, 0.33, 0.45, 0.5, 0.53, 0.57, 0.62, 0.78, 0.92];

const V1_START: Rig = { target: [2.4, 0.35, 0], dist: 5.3, yaw: 74, elev: -10, roll: -21, fov: 44, focusOffset: 0.3, aperture: 0.95 };
const V1_END: Rig = { target: [0.6, 0.35, 0], dist: 4.4, yaw: 52, elev: -12, roll: -19, fov: 44, focusOffset: -0.5, aperture: 0.75 };

/** Version 1 — matches the reference: slow oblique push that swings down the helix axis. */
export const referenceVariant: DnaVariant = {
  id: "v1",
  seed: 7,
  rungHues: RAINBOW,
  rungSaturation: 0.88,
  backboneColor: [0.5, 0.6, 1.0],
  spin: (t) => -1.05 * t,
  camera: (t, duration) => {
    const u = t / duration;
    const k = u * 0.55 + u * u * 0.45; // push accelerates into the shot
    return rigToCamera(mixRig(V1_START, V1_END, k));
  },
  exposure: 3.3,
  bloomNear: 0.75,
  bloomWide: 0.5,
};

const V2_START: Rig = { target: [4.5, -0.3, 0], dist: 7.0, yaw: 150, elev: -22, roll: 18, fov: 40, focusOffset: 0, aperture: 0.55 };
const V2_END: Rig = { target: [9, -0.7, 0], dist: 5.6, yaw: 100, elev: -8, roll: 4, fov: 40, focusOffset: 0, aperture: 0.55 };

/** Version 2 — same rainbow DNA, new camera: low-angle orbit travelling against the helix. */
export const orbitVariant: DnaVariant = {
  ...referenceVariant,
  id: "v2",
  camera: (t, duration) => rigToCamera(mixRig(V2_START, V2_END, easeInOut(t / duration))),
};
