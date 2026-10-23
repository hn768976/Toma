import { interpolate, Easing } from "remotion";

export type ScoreDollyVariant = "reference" | "craneOrbit";

export type CameraShot = {
  fov: number;
  position: [number, number, number];
  target: [number, number, number];
  roll: number;
  focus: number;
  aperture: number;
  light: [number, number, number, number];
  ghostOffset: [number, number];
  exposure: number;
};

// Page coordinates: the page lies in the XZ plane, x in [-8, 8] (along the
// staves), z in [-4, 4] (top of the page at -4), surface at y = 0.
const orbit = (
  target: [number, number, number],
  yaw: number,
  pitch: number,
  dist: number,
): [number, number, number] => {
  const fx = Math.sin(yaw) * Math.cos(pitch);
  const fy = -Math.sin(pitch);
  const fz = -Math.cos(yaw) * Math.cos(pitch);
  return [target[0] - fx * dist, target[1] - fy * dist, target[2] - fz * dist];
};

const ease = Easing.bezier(0.42, 0, 0.58, 1);

// Version 1: low, grazing camera tracking slowly along the grand staff from
// the opening clefs, shallow depth of field, warm pool of light.
const referenceShot = (p: number): CameraShot => {
  const tx = interpolate(p, [0, 1], [-4.85, -2.2]);
  const tz = interpolate(p, [0, 1], [-1.62, -1.45]);
  const target: [number, number, number] = [tx, 0, tz];
  const yaw = interpolate(p, [0, 1], [0.72, 0.68]);
  const pitch = 0.56;
  const dist = 1.8;
  return {
    fov: 34,
    position: orbit(target, yaw, pitch, dist),
    target,
    roll: -0.05,
    focus: dist,
    aperture: 0.05,
    light: [interpolate(p, [0, 1], [0.4, 0.34]), 0.8, 0.55, 0.34],
    ghostOffset: [p * 0.55, p * 0.08],
    exposure: 1.1,
  };
};

// Version 2: alternative camera move. A high, near top-down crane view that
// orbits around the page while descending into a low grazing angle with a
// rack focus, ending on a close push-in along the staff.
const craneShot = (p: number): CameraShot => {
  const e = ease(p);
  const target: [number, number, number] = [
    interpolate(e, [0, 1], [-1.2, 2.2]),
    0,
    interpolate(e, [0, 1], [0.9, -0.6]),
  ];
  const yaw = interpolate(e, [0, 1], [-0.85, 0.55]);
  const pitch = interpolate(e, [0, 1], [1.28, 0.52]);
  const dist = interpolate(e, [0, 1], [3.3, 1.6]);
  return {
    fov: 34,
    position: orbit(target, yaw, pitch, dist),
    target,
    roll: interpolate(e, [0, 1], [0.1, -0.05]),
    focus: dist * interpolate(p, [0, 0.55, 1], [1.0, 0.86, 1.0]),
    aperture: interpolate(e, [0, 1], [0.035, 0.05]),
    light: [interpolate(e, [0, 1], [0.55, 0.42]), interpolate(e, [0, 1], [0.62, 0.78]), 0.55, 0.32],
    ghostOffset: [-p * 0.4, p * 0.2],
    exposure: 1.1,
  };
};

export const cameraForVariant = (v: ScoreDollyVariant, p: number): CameraShot =>
  v === "reference" ? referenceShot(p) : craneShot(p);
