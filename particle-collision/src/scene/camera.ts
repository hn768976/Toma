import { Easing, interpolate } from "remotion";
import { CROSSING } from "./geometry";

export type Variant = "v1" | "v2";

export type CameraState = {
  position: [number, number, number];
  target: [number, number, number];
  fov: number;
  roll: number; // radians
  focus: number; // focus distance in world units
  screen: [number, number]; // where the target lands on screen (0..1, 0..1 from top-left)
};

const deg = Math.PI / 180;

const orbit = (
  target: [number, number, number],
  dist: number,
  azimuth: number,
  elevation: number,
): [number, number, number] => [
  target[0] + dist * Math.cos(elevation) * Math.sin(azimuth),
  target[1] + dist * Math.sin(elevation),
  target[2] + dist * Math.cos(elevation) * Math.cos(azimuth),
];

// t: 0..1 over the whole composition
export const getCamera = (variant: Variant, t: number): CameraState => {
  const ease = Easing.inOut(Easing.sin);
  if (variant === "v1") {
    // Reference move: a slow, continuous downward tilt from an elevated,
    // oblique view of the broad particle sheets to an almost edge-on view in
    // which the sheets collapse into two bright crossing filaments.
    const e = ease(t);
    const k = [0, 0.5, 1];
    const target = CROSSING;
    const elevation = interpolate(e, k, [30, 12, 4]) * deg;
    const azimuth = interpolate(e, k, [-26, 4, 14]) * deg;
    const dist = interpolate(e, k, [8.6, 11.5, 13.0]);
    return {
      position: orbit(target, dist, azimuth, elevation),
      target,
      fov: 42,
      roll: interpolate(e, k, [-4, 2, 7]) * deg,
      focus: dist,
      screen: [interpolate(e, k, [0.6, 0.52, 0.46]), interpolate(e, k, [0.76, 0.77, 0.72])],
    };
  }
  // V2: low-angle orbit around the collision point with a crane-up and push-in.
  const e = ease(t);
  const target = CROSSING;
  const azimuth = interpolate(e, [0, 1], [-62, 48]) * deg;
  const elevation = interpolate(e, [0, 0.5, 1], [3, 18, 34]) * deg;
  const dist = interpolate(e, [0, 1], [13.5, 11.2]);
  return {
    position: orbit(target, dist, azimuth, elevation),
    target,
    fov: 44,
    roll: interpolate(e, [0, 1], [8, -6]) * deg,
    focus: dist,
    screen: [0.5, 0.57],
  };
};
