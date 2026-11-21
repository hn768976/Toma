/**
 * config.ts - colours, counts and timings. Edit here.
 * (Light, atmosphere, lens and grade live in look.ts.)
 * Lengths are millimetres. X = across the module, Y = along it (0 at the near end).
 */

export const VIDEO = {
  width: 3840,
  height: 2160,
  fps: 30,
  /** reference: 15.015 s at 29.97 fps = 450 frames; at 30 fps = 15.000 s */
  durationInFrames: 450,
} as const;

export type Variant = "v1" | "v2";

export const PALETTE = {
  table: "#9aa3a2",
  pcb: "#0a4a48",
  pcbEdge: "#083b39",
  trace: "#27857b",
  pad: "#8aa0a4",
  chipBody: "#384347",
  chipMark: "#6f7f8a",
  lead: "#b4bcc0",
  gold: "#a8957a",
  smd: "#4f5d66",
} as const;

/** The memory module. */
export const MODULE = {
  width: 31.75,
  length: 133.35,
  thickness: 1.3,
  chips: 7,
  chipPitch: 18.6,
  chipFirstY: 10.6,
  /** chips sit left of centre; the right edge carries the SMD column and the gold fingers */
  chipX: -3.4,
  chipSize: [22.2, 14.2, 1.25],
  pinsPerSide: 40,
  pinPitch: 0.5,
  fingerPitch: 1.27,
  fingerLength: 2.9,
  /** keying slot in the finger edge, between chips 3 and 4 */
  keySlotY: 57.6,
  keySlotSize: [3.2, 1.9],
  smdX: 9.6,
  smdPitch: 3.72,
} as const;

export type PackageKind = "dip" | "soic" | "qfp" | "plcc";

/** Loose components scattered on the table around the module. rotDeg is about the vertical axis. */
export const PACKAGES: {
  kind: PackageKind;
  x: number;
  y: number;
  rotDeg: number;
  size: [number, number, number];
  leadsPerSide: number;
}[] = [
  { kind: "dip", x: -55, y: 22, rotDeg: 8.5, size: [15, 46, 5], leadsPerSide: 9 },
  { kind: "soic", x: -31, y: 26, rotDeg: 8, size: [13.5, 19, 5.5], leadsPerSide: 4 },
  { kind: "dip", x: 36, y: 22.5, rotDeg: 18.5, size: [13, 52, 5.5], leadsPerSide: 10 },
  { kind: "qfp", x: -54.7, y: 85.2, rotDeg: 19, size: [52, 49.5, 6], leadsPerSide: 14 },
  { kind: "plcc", x: 37, y: 93.5, rotDeg: -9, size: [24, 21, 7], leadsPerSide: 7 },
];

/** A value at the start, the middle and the end of the move (smoothly interpolated). */
export type Key3 = [number, number, number];

export type CameraRig = {
  fovDeg: number;
  /** camera-to-ground distance along the optical axis */
  distance: number;
  /** look-down angle below the horizon, degrees */
  elevationDeg: Key3;
  /** heading relative to the module axis, degrees (positive = module leans right on screen) */
  yawDeg: Key3;
  rollDeg: Key3;
  /** ground point the camera looks at */
  lookX: Key3;
  lookY: Key3;
  /** focus distance as a fraction of `distance` (1 = on the look point) */
  focusBias: number;
};

/**
 * Version 1: the reference move - a slow glide along the module at a three-quarter
 * angle, tilting down a little over the first half.
 * Version 2: the one change - the camera angle. Same glide, same timing, seen from
 * almost straight above (a plan view), with the module square to the frame.
 */
export const CAMERAS: Record<Variant, CameraRig> = {
  v1: {
    fovDeg: 17.86,
    distance: 178,
    elevationDeg: [37, 46, 46],
    yawDeg: [7, 9.2, 9.7],
    rollDeg: [0, 0, 0],
    lookX: [-8, -6.7, -5.2],
    lookY: [21.9, 63.1, 104.7],
    focusBias: 1.0,
  },
  v2: {
    fovDeg: 17.86,
    distance: 178,
    elevationDeg: [80, 80, 80],
    yawDeg: [0, 0, 0],
    rollDeg: [0, 0, 0],
    lookX: [-4, -4, -4],
    lookY: [21.9, 63.1, 104.7],
    focusBias: 1.0,
  },
};

/** Moments used for look development (frame numbers). */
export const LOOKDEV_FRAMES = [0, 224, 449] as const;
export const SEED = 4129653;
