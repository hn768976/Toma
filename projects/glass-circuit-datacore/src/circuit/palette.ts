export type Variant = "v1" | "v2";

/** Look & grade of the scene (all colours linear-light unless noted). */
export type CircuitLook = {
  background: string;
  fin: string;
  finMetalness: number;
  finRoughness: number;
  glowColor: string;
  glowIntensity: number;
  /** emissive highlight on the top edges of the fins */
  tipGlow: number;
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
  fin: "#4a5460",
  finMetalness: 0.8,
  finRoughness: 0.18,
  glowColor: "#dfeaff",
  glowIntensity: 0.7,
  tipGlow: 0.07,
  glassTint: "#3a4656",
  glassEdge: "#b9d2f2",
  glyphColor: "#e8f2ff",
  keyColor: "#cfe0ff",
  keyIntensity: 1.8,
  rimColor: "#e6f0ff",
  rimIntensity: 4.0,
  envIntensity: 0.32,
  exposure: 0.86,
  bloomStrength: 0.3,
  bloomRadius: 0.45,
  bloomThreshold: 0.95,
  gradeShadows: [0.8, 0.92, 1.08],
  gradeHighlights: [0.95, 0.99, 1.03],
  gradeSaturation: 0.85,
  gradeLift: -0.048,
  vignette: 0.35,
  grain: 0.018,
};
