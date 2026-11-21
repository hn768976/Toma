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
  table: "#969ea2",
  pcb: "#0b5350",
  pcbEdge: "#083b39",
  trace: "#1f8076",
  pad: "#b4c0c2",
  chipBody: "#384347",
  chipMark: "#6f7f8a",
  lead: "#8f989d",
  pin: "#d5dbde",
  smdPad: "#5f7578",
  gold: "#c49a68",
  smd: "#5d6b72",
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
  chipSize: [22.2, 13.4, 1.25],
  pinsPerSide: 54,
  pinPitch: 0.38,
  fingerPitch: 1.0,
  fingerLength: 2.6,
  /** keying slot in the finger edge, between chips 3 and 4 */
  keySlotY: 57.6,
  keySlotSize: [3.2, 1.9],
  /** two columns of tiny parts beside the fingers */
  smdX: [9.0, 10.7] as [number, number],
  smdPitch: 1.9,
  smdSize: [1.15, 0.85, 0.45] as [number, number, number],
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
  { kind: "dip", x: -57, y: 21, rotDeg: 8.5, size: [15, 42, 5], leadsPerSide: 8 },
  { kind: "soic", x: -31, y: 25, rotDeg: 8, size: [13.5, 19, 6], leadsPerSide: 4 },
  { kind: "dip", x: 33.4, y: 30, rotDeg: 18.5, size: [13, 36, 5.5], leadsPerSide: 7 },
  { kind: "qfp", x: -54.7, y: 89.5, rotDeg: 19, size: [52, 49.5, 6], leadsPerSide: 14 },
  { kind: "plcc", x: 37, y: 93.5, rotDeg: -9, size: [24, 21, 7], leadsPerSide: 7 },
];

/** A value at the start, the middle and the end of the move (smoothly interpolated). */
export type Key3 = [number, number, number];

export type CameraRig = {
  fovDeg: number;
  /** camera-to-ground distance along the optical axis */
  distance: Key3;
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
    distance: [178, 187, 190],
    elevationDeg: [37, 46, 46],
    yawDeg: [7, 7.6, 7.6],
    rollDeg: [0, 0, 0],
    lookX: [-8, -6.7, -5.2],
    lookY: [21.9, 63.1, 104.7],
    focusBias: 1.0,
  },
  v2: {
    fovDeg: 17.86,
    distance: [178, 187, 190],
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
