import * as THREE from "three";

/** Everything that differs between the two versions of the composition. */
export type BloodPalette = {
  name: string;
  /** Vessel wall: albedo in the creases and on the ridges. */
  wallLow: THREE.Color;
  wallHigh: THREE.Color;
  /** Wet highlight on the wall. */
  wallSpec: THREE.Color;
  /** Light that sits further down the vessel. */
  keyLight: THREE.Color;
  /** Weak light travelling with the camera. */
  headLight: THREE.Color;
  ambient: THREE.Color;
  /** Colour the vessel fades to in the distance (HDR). */
  glow: THREE.Color;
  /** Red blood cells. */
  cell: THREE.Color;
  cellFar: THREE.Color;
  /** Grade. */
  tint: THREE.Color;
  lift: THREE.Color;
  vignetteColor: THREE.Color;
  saturation: number;
  background: string;
};

const c = (r: number, g: number, b: number) => new THREE.Color(r, g, b);

/** Version 1 – matches the reference: deep crimson tissue, salmon glow. */
export const CRIMSON: BloodPalette = {
  name: "crimson",
  wallLow: c(0.03, 0.009, 0.0075),
  wallHigh: c(0.17, 0.08, 0.071),
  wallSpec: c(0.6, 0.42, 0.4),
  keyLight: c(1.0, 0.6, 0.56),
  headLight: c(0.62, 0.36, 0.33),
  ambient: c(0.012, 0.002, 0.0017),
  glow: c(1.3, 0.2, 0.185),
  cell: c(0.11, 0.009, 0.006),
  cellFar: c(0.8, 0.055, 0.035),
  tint: c(1.0, 0.97, 0.97),
  lift: c(0.008, 0.0028, 0.0022),
  vignetteColor: c(0.3, 0.03, 0.03),
  saturation: 1.0,
  background: "#120202",
};

/**
 * Version 2 – alternative palette: the same shot graded as a cold,
 * deoxygenated "venous" look. Indigo tissue, electric cyan glow at the end of
 * the vessel and violet-magenta cells.
 */
export const VENOUS: BloodPalette = {
  name: "venous",
  wallLow: c(0.007, 0.012, 0.034),
  wallHigh: c(0.06, 0.1, 0.19),
  wallSpec: c(0.36, 0.5, 0.62),
  keyLight: c(0.5, 0.78, 1.0),
  headLight: c(0.3, 0.42, 0.66),
  ambient: c(0.0016, 0.003, 0.013),
  glow: c(0.16, 0.72, 1.3),
  cell: c(0.062, 0.01, 0.12),
  cellFar: c(0.42, 0.1, 0.85),
  tint: c(0.97, 0.98, 1.0),
  lift: c(0.002, 0.003, 0.009),
  vignetteColor: c(0.02, 0.05, 0.3),
  saturation: 1.0,
  background: "#02030f",
};
