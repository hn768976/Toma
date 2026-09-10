/**
 * Global composition constants and the two colour schemes.
 *
 * Everything downstream is expressed as a fraction of the frame height so the
 * artwork is resolution-independent: the compositions are defined at 3840x2160
 * and rendered at --scale=0.5 for the 1080p deliverables.
 */

export const FPS = 30;
export const DURATION_IN_FRAMES = 900; // 30s, the loop period
export const WIDTH = 3840;
export const HEIGHT = 2160;

export type Palette = {
  /** Page background, behind the nebula. */
  background: string;
  /** Nebula cloud colours, dim -> bright. */
  nebula: [string, string, string];
  /** Sparse cool accent inside the nebula (the teal patches in the reference). */
  nebulaAccent: string;
  /** Ramp for the standalone accent cloud layer. */
  accentRamp: [string, string, string];
  /** Star colours, faint -> brilliant. */
  star: [string, string];
  /** Wheel line work, base -> brightest. */
  wheelLine: string;
  wheelBright: string;
  /** Colour the wheel's glow pass is drawn in. */
  wheelGlow: string;
  /** Sunburst body, highlight and white-hot core. */
  burstDeep: string;
  burstBody: string;
  burstHot: string;
  burstCore: string;
  /** Constellation hairlines. */
  constellation: string;
};

export const GOLD: Palette = {
  background: "#050308",
  nebula: ["#6b2a04", "#d4650a", "#ffc247"],
  nebulaAccent: "#1f8fa8",
  accentRamp: ["#04212c", "#0e6a7e", "#44c4d6"],
  star: ["#c8b898", "#fff4dc"],
  wheelLine: "#e0a828",
  wheelBright: "#fff0c0",
  wheelGlow: "#ff9c2e",
  burstDeep: "#c9560c",
  burstBody: "#f0a81a",
  burstHot: "#ffd24a",
  burstCore: "#fffdf2",
  constellation: "#b9a98c",
};

export const SILVER: Palette = {
  background: "#02040a",
  nebula: ["#0d2646", "#166a8c", "#48b6c4"],
  nebulaAccent: "#3c46a4",
  accentRamp: ["#0a1030", "#2b3180", "#6470d8"],
  star: ["#9fb0c8", "#ffffff"],
  wheelLine: "#a8c8e8",
  wheelBright: "#ffffff",
  wheelGlow: "#6fa8e8",
  burstDeep: "#2a5c94",
  burstBody: "#9cc4ec",
  burstHot: "#dbe9fb",
  burstCore: "#ffffff",
  constellation: "#8fa4bc",
};

/**
 * Wheel geometry. All radii are fractions of the wheel's outer radius R,
 * measured in the disc's own (un-squashed) plane.
 */
export const WHEEL = {
  /** Outer radius as a fraction of frame height. */
  radiusOfHeight: 0.868,
  /** Centre position as a fraction of frame width / height. */
  centerX: 0.383,
  centerY: 0.562,
  /** The single fixed vertical squash that bakes in the tilt. */
  squash: 0.575,

  /** Ring radii, outermost inward. */
  rOuterDots: 1.0,
  rOuterCircle: 0.951,
  rTickOut: 0.941,
  rTickIn: 0.862,
  rNameOut: 0.852,
  rNameIn: 0.724,
  rGlyphOut: 0.714,
  rGlyphIn: 0.552,
  rMarkers: 0.5,
  rAspect: 0.436,
  rInnerA: 0.33,
  rInnerB: 0.185,

  /** Sunburst radius, in the same disc units. */
  rBurst: 0.148,

  /** Faint ellipses and radials that continue past the wheel. */
  rHalo: [1.09, 1.185, 1.34] as const,
  rRadialOut: 2.4,
} as const;

export const SIGN_NAMES = [
  "ARIES",
  "TAURUS",
  "GEMINI",
  "CANCER",
  "LEO",
  "VIRGO",
  "LIBRA",
  "SCORPIO",
  "SAGITTARIUS",
  "CAPRICORN",
  "AQUARIUS",
  "PISCES",
] as const;
