import * as THREE from "three";
import { lerp, smoothstep } from "./random";

/* ------------------------------------------------------------------------ */
/* Colour look (shared by both versions — Version 2 changes the camera).    */
/* ------------------------------------------------------------------------ */
type Swatch = { color: [number, number, number]; weight: number; gain: [number, number] };

export const LINE_SWATCHES: Swatch[] = [
  { color: [0.05, 0.2, 1.0], weight: 0.3, gain: [0.25, 0.55] }, // deep blue
  { color: [0.1, 0.45, 1.0], weight: 0.28, gain: [0.45, 0.9] }, // azure
  { color: [0.2, 0.8, 1.0], weight: 0.26, gain: [0.7, 1.3] }, // cyan
  { color: [0.55, 0.9, 1.0], weight: 0.07, gain: [0.8, 1.2] }, // ice white
  { color: [0.38, 0.22, 1.0], weight: 0.06, gain: [0.5, 0.9] }, // violet
  { color: [0.8, 0.25, 1.0], weight: 0.03, gain: [0.45, 0.8] }, // magenta
];

export const HOT_COLOR = new THREE.Color(0.85, 0.97, 1.0);
export const SPARKLE_COLOR = new THREE.Color(0.55, 0.85, 1.0);

export const BACKGROUND = {
  top: new THREE.Color(0.0, 0.01, 0.04),
  horizon: new THREE.Color(0.01, 0.05, 0.16),
  bottom: new THREE.Color(0.0, 0.015, 0.06),
  glowColor: new THREE.Color(0.012, 0.06, 0.2),
};

/* ------------------------------------------------------------------------ */
/* Camera rigs.                                                              */
/* Version 1 reproduces the reference: two gently drifting shots with a cut. */
/* Version 2 keeps the same scenes but uses sweeping, rolling camera moves.  */
/* ------------------------------------------------------------------------ */
export type CameraState = {
  pos: THREE.Vector3;
  target: THREE.Vector3;
  fov: number;
  roll: number; // radians
  focus: number; // focus distance
  coc: number; // depth-of-field strength (1080p px)
  glow: [number, number]; // horizon glow position (uv)
  exposure: number; // tone-mapping exposure
};

const v3 = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
const mix3 = (a: THREE.Vector3, b: THREE.Vector3, t: number) => a.clone().lerp(b, t);
const ease = (t: number) => smoothstep(0, 1, t);

export type Version = "reference" | "alt-camera";

export const cameraFor = (
  version: Version,
  shot: 0 | 1,
  t: number, // seconds since shot start
  duration: number, // shot duration (s)
): CameraState => {
  const k = t / duration;
  if (version === "reference") {
    if (shot === 0) {
      // the reference camera is essentially locked off: a barely-there push
      return {
        pos: mix3(v3(-0.3, 0.3, 12.0), v3(-0.2, 0.32, 11.8), k),
        target: mix3(v3(1.9, 1.0, -2), v3(1.95, 1.02, -2), k),
        fov: 42,
        roll: 0,
        focus: 6.5,
        coc: 6,
        glow: [0.62, 0.8],
        exposure: 2.0,
      };
    }
    return {
      pos: mix3(v3(1.0, 5.6, 6.6), v3(0.85, 5.45, 6.3), k),
      target: mix3(v3(1.9, 0.6, -2.4), v3(1.8, 0.6, -2.5), k),
      fov: 50,
      roll: lerp(0.0, -0.01, k),
      focus: 8.0,
      coc: 9,
      glow: [0.3, 0.95],
      exposure: 1.35,
    };
  }
  // ---- Version 2: alternative camera movement --------------------------
  if (shot === 0) {
    // Low tracking shot that sweeps right-to-left along the foot of the
    // wall, banking all the way and staying low.
    const e = ease(k);
    return {
      pos: v3(lerp(7.5, -6.0, e), lerp(-0.5, 0.4, e), lerp(9.5, 10.5, e)),
      target: v3(lerp(-1.0, 3.5, e), lerp(3.4, 2.6, e), -3),
      fov: lerp(36, 44, e),
      roll: lerp(0.2, 0.1, e),
      focus: lerp(9.5, 12.0, e),
      coc: 9,
      glow: [lerp(0.35, 0.7, e), 0.8],
      exposure: 1.9,
    };
  }
  // Overhead crane that orbits around the hairpin, staying high above it.
  const e = ease(k);
  const ang = lerp(-1.1, 1.0, e);
  const radius = lerp(9.0, 7.5, e);
  const centre = v3(0.6, 0, -0.3);
  return {
    pos: v3(
      centre.x + Math.sin(ang) * radius,
      lerp(12.0, 7.0, e),
      centre.z + Math.cos(ang) * radius,
    ),
    target: v3(lerp(-0.6, 1.0, e), lerp(-0.2, 0.6, e), lerp(0.0, -0.8, e)),
    fov: lerp(46, 52, e),
    roll: lerp(-0.25, 0.1, e),
    focus: lerp(12.0, 8.5, e),
    coc: 9,
    glow: [lerp(0.7, 0.4, e), 0.95],
    exposure: 1.2,
  };
};
