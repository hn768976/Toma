import { Easing, interpolate } from "remotion";

export type CameraPose = {
  position: [number, number, number];
  target: [number, number, number];
  roll: number; // radians around the view axis
  fov: number;
  focus: number; // focal distance from the lens
  aperture: number;
  glow: [number, number]; // screen-space position of the backdrop glow
};

export type CameraRigName = "lowTracking" | "craneSweep";

// Version 1: low, tilted shot beside the track, as in the reference — near
// arcs huge in the upper left, track vanishing lower right. The camera only
// drifts on closed, periodic paths (the flow comes from the filaments
// travelling toward it), so the clip loops seamlessly like the reference.
const lowTracking = (t: number, duration: number): CameraPose => {
  const c = (t / duration) * Math.PI * 2;
  // Two- and three-cycle swings layered on the base path: the camera
  // sways and yaws like a slow handheld drift, still closing the loop.
  const sway = Math.sin(2 * c) * 0.3 + Math.sin(3 * c + 1) * 0.12;
  const x = 1.0 * Math.sin(c + 0.8);
  return {
    position: [x, -0.75 + Math.sin(3 * c) * 0.12, 2.5 + sway],
    target: [x + 10, 2.1 + Math.sin(2 * c + 0.6) * 0.5, -0.4 + Math.sin(3 * c + 2) * 0.8],
    roll: 0.1 + Math.sin(2 * c + 2.1) * 0.05,
    fov: 46,
    focus: 4.5,
    aperture: 0.011,
    glow: [1.0, 1.0],
  };
};

// Version 2: an over-the-top crane/orbit. The camera starts high on the
// near side of the track, sweeps up and over it, and settles into a low
// angle on the far side, so the track ends up crossing the frame in the
// opposite diagonal while the arcs rise toward the lens.
const craneSweep = (t: number, duration: number): CameraPose => {
  const p = interpolate(t, [0, duration], [0, 1], {
    easing: Easing.inOut(Easing.sin),
  });
  const x = 0.3 * t;
  // Angle around the track axis: 0 = level on the near side (+z),
  // PI/2 = overhead, PI = level on the far side (-z).
  const angle = interpolate(p, [0, 1], [0.85, Math.PI - 0.32]);
  const radius = interpolate(p, [0, 0.5, 1], [5.2, 6.2, 3.4]);
  return {
    position: [x - 1, 0.25 + Math.sin(angle) * radius, Math.cos(angle) * radius],
    target: [x + 3.2, 0.7, 0],
    roll: interpolate(p, [0, 1], [0.12, -0.2]),
    fov: 42,
    focus: radius + 0.8,
    aperture: 0.016,
    glow: [interpolate(p, [0, 1], [0.85, 0.12]), 0.92],
  };
};

export const getCameraPose = (
  rig: CameraRigName,
  t: number,
  duration: number,
): CameraPose => (rig === "lowTracking" ? lowTracking(t, duration) : craneSweep(t, duration));
