import { Easing, interpolate } from "remotion";
import { DURATION_IN_FRAMES } from "./constants";

// Everything the frame needs from the camera at a given frame.
// tx/ty: the world point (px) the camera is aimed at (lands at frame
// center). z: dolly toward (+) / away from (-) the page. rx/ry/rz: page
// tilt in degrees. focus*: screen-space center/size (0..1) of the sharp
// depth-of-field zone. introBlur/aberration: glitch-in strength (px).
export type CameraState = {
  tx: number;
  ty: number;
  z: number;
  rx: number;
  ry: number;
  rz: number;
  focusX: number;
  focusY: number;
  focusW: number;
  focusH: number;
  dofBlur: number;
  introBlur: number;
  aberration: number;
};

export type CameraMove = "reference" | "orbit";

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

const ease = (
  frame: number,
  input: [number, number],
  output: [number, number],
  easing: (t: number) => number = Easing.inOut(Easing.cubic),
) => interpolate(frame, input, output, { ...clamp, easing });

// Low-amplitude, non-repeating "handheld" sway built from detuned sines.
const sway = (frame: number, seed: number) =>
  Math.sin(frame * 0.031 + seed) * 0.6 +
  Math.sin(frame * 0.057 + seed * 2.3) * 0.3 +
  Math.sin(frame * 0.113 + seed * 4.1) * 0.1;

// Shared opening: the shot snaps in from a heavy defocus with an RGB
// split that settles over the first second, with a couple of flickers.
const glitchIn = (frame: number) => {
  const introBlur = ease(frame, [0, 26], [34, 0], Easing.out(Easing.cubic));
  const flicker = frame === 9 || frame === 16 ? 1.6 : 1;
  const aberration =
    ease(frame, [0, 30], [26, 0], Easing.out(Easing.quad)) * flicker;
  return { introBlur, aberration };
};

// Version A: matches the reference. Low-angle close-up on a tilted page
// with a slow lateral truck to the right along the headline and a very
// gentle push-in. Focus sits on "Now Run Entire" throughout.
const referenceMove = (frame: number): CameraState => {
  const t = ease(
    frame,
    [0, DURATION_IN_FRAMES - 1],
    [0, 1],
    Easing.inOut(Easing.sin),
  );
  return {
    tx: interpolate(t, [0, 1], [3050, 3800]) + sway(frame, 1) * 18,
    ty: interpolate(t, [0, 1], [2200, 2240]) + sway(frame, 2) * 12,
    z: interpolate(t, [0, 1], [-20, 170]),
    rx: 24 + sway(frame, 3) * 0.35,
    ry: -15 + sway(frame, 4) * 0.35,
    rz: interpolate(t, [0, 1], [-3.4, -2.8]),
    focusX: 0.6,
    focusY: 0.38,
    focusW: 0.5,
    focusH: 0.34,
    dofBlur: 12,
    ...glitchIn(frame),
  };
};

// Version B: a different camera. Starts high and wide, looking down on
// the body copy, then cranes down and orbits round to a low grazing
// angle while racking focus up onto the headline, ending in a slow
// push-in on "AI Agents".
const orbitMove = (frame: number): CameraState => {
  const swing = ease(frame, [0, 190], [0, 1], Easing.inOut(Easing.cubic));
  const settle = ease(
    frame,
    [150, DURATION_IN_FRAMES - 1],
    [0, 1],
    Easing.inOut(Easing.sin),
  );
  const rack = ease(frame, [70, 160], [0, 1], Easing.inOut(Easing.quad));
  return {
    tx:
      interpolate(swing, [0, 1], [4800, 2900]) +
      interpolate(settle, [0, 1], [0, -450]) +
      sway(frame, 5) * 14,
    ty:
      interpolate(swing, [0, 1], [3150, 2180]) +
      interpolate(settle, [0, 1], [0, -40]) +
      sway(frame, 6) * 10,
    z:
      interpolate(swing, [0, 1], [-850, 0]) +
      interpolate(settle, [0, 1], [0, 650]),
    rx: interpolate(swing, [0, 1], [8, 34]) + sway(frame, 7) * 0.3,
    ry: interpolate(swing, [0, 1], [16, -20]) + sway(frame, 8) * 0.3,
    rz: interpolate(swing, [0, 1], [7, -9]),
    focusX: interpolate(rack, [0, 1], [0.5, 0.5]),
    focusY: interpolate(rack, [0, 1], [0.5, 0.42]),
    focusW: interpolate(rack, [0, 1], [0.6, 0.46]),
    focusH: interpolate(rack, [0, 1], [0.5, 0.3]),
    // Shallower depth of field as the camera gets closer to the page.
    dofBlur: interpolate(swing, [0, 1], [8, 18]),
    ...glitchIn(frame),
  };
};

export const getCamera = (move: CameraMove, frame: number): CameraState =>
  move === "orbit" ? orbitMove(frame) : referenceMove(frame);
