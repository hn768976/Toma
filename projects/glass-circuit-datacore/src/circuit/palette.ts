export type Variant = "v1" | "v2";

/** Look & grade of the scene (all colours linear-light unless noted). */
export type CircuitLook = {
  background: string;
  fin: string;
  finMetalness: number;
  finRoughness: number;
  glowColor: string;
  glowIntensity: number;
  glassTint: string;
  glassEdge: string;
  glyphColor: string;
  keyColor: string;
  keyIntensity: number;
  rimColor: string;
  rimIntensity: number;
  envIntensity: number;
  exposure: number;
  bloomStrength: number;
  bloomRadius: number;
  bloomThreshold: number;
  /** grade (display-referred): shadows tint, highlights tint, saturation */
  gradeShadows: [number, number, number];
  gradeHighlights: [number, number, number];
  gradeSaturation: number;
  /** display-referred black lift (milky haze of the reference) */
  gradeLift: number;
  vignette: number;
  grain: number;
};

/**
 * Both versions share the reference's cool, desaturated steel-blue grade.
 * Version 2 differs by its camera work (see camera.ts), not its palette.
 */
export const LOOK: CircuitLook = {
  background: "#05080c",
  fin: "#30373f",
  finMetalness: 0.88,
  finRoughness: 0.22,
  glowColor: "#dfeaff",
  glowIntensity: 1.1,
  glassTint: "#2a3644",
  glassEdge: "#cfe3ff",
  glyphColor: "#e8f2ff",
  keyColor: "#cfe0ff",
  keyIntensity: 1.4,
  rimColor: "#e6f0ff",
  rimIntensity: 3.0,
  envIntensity: 0.6,
  exposure: 1.0,
  bloomStrength: 0.42,
  bloomRadius: 0.45,
  bloomThreshold: 1.0,
  gradeShadows: [0.82, 0.92, 1.08],
  gradeHighlights: [0.92, 0.97, 1.04],
  gradeSaturation: 0.55,
  gradeLift: 0.03,
  vignette: 0.35,
  grain: 0.018,
};
