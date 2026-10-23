import { interpolate } from "remotion";

// Every key time below was measured frame-by-frame from the reference clip
// (555 frames @ 30 fps).
const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

// Turbine spins at a constant rate between frames 60 and 495:
// exactly 15 clockwise turns, so it stops in the same pose it started in.
export const TURBINE_START = 60;
export const TURBINE_END = 495;
export const turbineAngle = (frame: number) =>
  interpolate(frame, [TURBINE_START, TURBINE_END], [0, -Math.PI * 2 * 15], clamp);

// Charge-controller LEDs: on one by one, off in reverse order.
const LED_ON = [90, 105, 120, 135];
const LED_OFF = [481, 466, 451, 436];
export const ledState = (frame: number, index: number) =>
  frame >= LED_ON[index] && frame < LED_OFF[index];

// Battery level 0..1: charges linearly 136 -> 225, drains linearly 331 -> 420.
export const batteryLevel = (frame: number) => {
  if (frame < 300) {
    return interpolate(frame, [136, 225], [0, 1], clamp);
  }
  return interpolate(frame, [331, 420], [1, 0], clamp);
};

// Tower windows light floor by floor (bottom up) while the battery charges,
// one floor every 15 frames from 135, and switch off top-down from 346.
export const FLOORS = 7;
export const floorLit = (frame: number, floor: number) =>
  frame >= 135 + floor * 15 && frame < 346 + (FLOORS - 1 - floor) * 15;

// Building and platform glow 0..1: ramps up 242 -> 249, down 321 -> 328.
export const glowAmount = (frame: number) => {
  if (frame < 290) {
    return interpolate(frame, [241, 249], [0, 1], clamp);
  }
  return interpolate(frame, [321, 329], [1, 0], clamp);
};

// The bulb over-exposes to white while switching, then settles on yellow.
export type BulbPhase = "off" | "flash" | "on";
export const bulbPhase = (frame: number): BulbPhase => {
  if (frame >= 242 && frame <= 247) return "flash";
  if (frame >= 248 && frame <= 321) return "on";
  if (frame >= 322 && frame <= 328) return "flash";
  return "off";
};
// Blend factor used on the transition frames (241/248/322/329) for smoothness.
export const bulbFlashMix = (frame: number) => {
  if (frame === 241 || frame === 329) return 0.25;
  if (frame === 248 || frame === 322) return 0.5;
  return 1;
};
