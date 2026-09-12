// Camera moves.
//
// The reference is essentially a locked-off macro shot: the operator is
// on sticks, but the rig still breathes and the lens still hunts. Holding
// a *perfectly* static 3D transform for 19 seconds looks synthetic
// immediately, so both variants ride a few slow, incommensurable sine
// waves — periods deliberately not multiples of each other, so the drift
// never visibly repeats inside the clip.

import { DURATION_IN_FRAMES } from "./constants";
import { fbm, mix } from "./noise";
import type { Camera } from "./optics";

export type Variant = "a" | "b";

const breathe = (frame: number, period: number, phase = 0) =>
  Math.sin((frame / period) * Math.PI * 2 + phase);

export const cameraFor = (variant: Variant, frame: number): Camera => {
  const t = frame / DURATION_IN_FRAMES;
  // Low-frequency handheld residue on top of the sines.
  const driftX = (fbm(frame * 0.006, 3, 3) - 0.5) * 2;
  const driftY = (fbm(frame * 0.006, 29, 3) - 0.5) * 2;

  if (variant === "a") {
    // Reference framing: wheels near and low-left, scopes far and
    // high-right, with a very slow creep in over the whole clip.
    const push = mix(0, 46, t);
    return {
      perspective: 1220,
      rotateZ: -18.5 + breathe(frame, 470) * 0.42 + driftX * 0.25,
      rotateY: 24 + breathe(frame, 610, 1.1) * 0.4,
      rotateX: 9 + breathe(frame, 530, 2.2) * 0.32 + driftY * 0.2,
      translateX: -180 + breathe(frame, 700, 0.4) * 9 + driftX * 5,
      translateY: -318 + breathe(frame, 640, 1.7) * 7 + driftY * 5,
      translateZ: -720 + push,
      // Focus sits on the trackball row and hunts very slightly, the way
      // a shallow lens does when nobody is touching it.
      focusX: 1320 + breathe(frame, 560, 0.9) * 60,
      focusY: 1650,
      aperture: 54,
      maxBlur: 26,
    };
  }

  // Variant B: mirrored rig. The plane rises to the left instead of the
  // right, and the camera does a slow lateral dolly with a real focus
  // rack from the node graph back onto the wheels.
  const rack = Math.min(1, Math.max(0, (t - 0.36) / 0.26));
  const dolly = mix(-60, 70, t);
  return {
    perspective: 1180,
    rotateZ: 15.5 + breathe(frame, 490, 0.6) * 0.45 + driftX * 0.22,
    rotateY: -23 + breathe(frame, 580, 2.4) * 0.45,
    rotateX: 10 + breathe(frame, 550, 1.3) * 0.36 + driftY * 0.2,
    translateX: -430 + dolly + breathe(frame, 720, 0.2) * 10,
    translateY: -268 + breathe(frame, 660, 2.9) * 8 + driftY * 5,
    translateZ: -430 + mix(0, 46, t),
    // Rack from the node tree down onto the trackball row. The two sit
    // at genuinely different depths on this rig, so this is a real focus
    // pull rather than a pan.
    focusX: mix(2690, 2310, rack),
    focusY: mix(690, 1590, rack),
    aperture: 46,
    maxBlur: 26,
  };
};
