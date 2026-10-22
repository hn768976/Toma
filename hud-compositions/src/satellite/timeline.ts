import { easeInOut, lerp, ramp } from "../common/math";
import { Camera } from "./camera";

export type SatelliteVariant = "reference" | "orbit";

/**
 * Beat sheet, in frames at 30 fps (reference timestamps in comments).
 */
export const T = {
  targetPing: 108, // 3.6 s red target dot pops on the pivot cluster
  iconC: 135, // 4.5 s "C" scan icon + dashed range circle
  lensStart: 150, // 5.0 s frosted halo sweeps on clockwise
  lensFull: 168, // 5.6 s
  amberRing: 168, // 5.6 s amber lens rim + label bar
  zoomStart: 360, // 12.0 s dive into the farm district
  zoomEnd: 398, // 13.3 s
  lockOn: 480, // 16.0 s targeting reticle draws on
  pulses: [495, 572, 632], // amber ring pulses
  iconA: 510, // 17.0 s "A" link icon
  contacts: 540, // 18.0 s secondary contacts on the right
  hostile: 588, // 19.6 s contacts and two nodes flip to red
} as const;

/** World point the scan locks on to in the regional shot. */
export const WIDE_TARGET = { x: 0.4, y: 1.2 };
/** World point at the centre of the close-up reticle. */
export const CLOSE_TARGET = { x: 0.4, y: 0.5 };

const wideRef = (f: number): Camera => {
  const t = ramp(f, 0, T.zoomStart);
  return {
    cx: lerp(-4.2, -3.7, t),
    cy: lerp(-2.4, -1.9, t),
    span: lerp(42, 38, t),
    rot: lerp(0.06, 0.035, t),
    tilt: 0.14,
  };
};

const closeRef = (f: number): Camera => {
  const t = ramp(f, T.zoomEnd, 668);
  return {
    cx: lerp(0.5, 0.15, t),
    cy: lerp(0.3, 0.6, t),
    span: lerp(7.0, 6.5, t),
    rot: lerp(0.0, -0.012, t),
    tilt: 0.16,
  };
};

const wideOrbit = (f: number): Camera => {
  const t = ramp(f, 0, T.zoomStart);
  return {
    cx: lerp(-1.0, -0.4, t),
    cy: lerp(-1.0, 0.6, t),
    span: lerp(44, 36, t),
    rot: lerp(-0.55, 0.25, t),
    tilt: lerp(0.95, 0.85, t),
  };
};

const closeOrbit = (f: number): Camera => {
  const t = ramp(f, T.zoomEnd, 668);
  return {
    cx: lerp(0.5, 0.3, t),
    cy: lerp(0.3, 0.6, t),
    span: lerp(6.4, 5.8, t),
    rot: lerp(0.45, 0.95, t),
    tilt: lerp(0.78, 0.86, t),
  };
};

const mixCam = (a: Camera, b: Camera, t: number): Camera => {
  // Interpolate span logarithmically so the zoom speed feels constant.
  const span = Math.exp(lerp(Math.log(a.span), Math.log(b.span), t));
  return {
    cx: lerp(a.cx, b.cx, t),
    cy: lerp(a.cy, b.cy, t),
    span,
    rot: lerp(a.rot, b.rot, t),
    tilt: lerp(a.tilt, b.tilt, t),
  };
};

export const cameraAt = (frame: number, variant: SatelliteVariant): Camera => {
  const wide = variant === "orbit" ? wideOrbit : wideRef;
  const close = variant === "orbit" ? closeOrbit : closeRef;
  if (frame <= T.zoomStart) return wide(frame);
  if (frame >= T.zoomEnd) return close(frame);
  const t = ramp(frame, T.zoomStart, T.zoomEnd, easeInOut);
  return mixCam(wide(T.zoomStart), close(T.zoomEnd), t);
};

/** Zoom factor of the dive relative to the regional shot (1 → ~5). */
export const diveScale = (frame: number, variant: SatelliteVariant) =>
  cameraAt(T.zoomStart, variant).span / cameraAt(frame, variant).span;
