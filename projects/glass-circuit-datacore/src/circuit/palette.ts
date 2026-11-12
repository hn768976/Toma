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
  /** midtone gamma (>1 darkens mids, keeps highlights) */
  gradeGamma: number;
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
  finRoughness: 0.34,
  glowColor: "#bcd4ff",
  glowIntensity: 1.2,
  tipGlow: 0.0,
  glassTint: "#3a4656",
  glassEdge: "#b9d2f2",
  glyphColor: "#e8f2ff",
  keyColor: "#cfe0ff",
  keyIntensity: 1.8,
  rimColor: "#e6f0ff",
  rimIntensity: 1.5,
  envIntensity: 0.42,
  exposure: 0.86,
  bloomStrength: 0.4,
  bloomRadius: 0.2,
  bloomThreshold: 0.9,
  gradeShadows: [0.76, 0.91, 1.12],
  gradeHighlights: [0.93, 0.99, 1.05],
  gradeSaturation: 0.85,
  gradeLift: -0.03,
  gradeGamma: 1.3,
  vignette: 0.35,
  grain: 0.018,
};
