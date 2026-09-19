// Format, palette and typography for the "Cyber Attack / System Hacked"
// glitch piece.
//
// The whole composition is authored against a 1920x1080 design grid and
// scaled by `scaleFor()`, so the 4K composition is the same edit at twice
// the linear size rather than a separate build.

export const FPS = 30;
export const DURATION_IN_FRAMES = 600; // 20.000s at 30fps

export const BASE_WIDTH = 1920;
export const BASE_HEIGHT = 1080;

/** Multiplier that turns a design-grid length into a length for `width`. */
export const scaleFor = (width: number): number => width / BASE_WIDTH;

/**
 * The glitch re-rolls on a 3-frame cadence (10Hz) rather than every frame.
 * Holding each state for 3 frames is what gives the piece its chunky,
 * "broken signal" stutter instead of a fizzy per-frame shimmer.
 */
export const GLITCH_HOLD = 3;

export const PALETTE = {
  /** Base canvas: not pure black, a very dark blue. */
  backdrop: "#04060f",
  /** Deep navy the calm passages settle into. */
  navy: "#0a1330",
  codeDim: "#2f5c96",
  codeMid: "#4f86cf",
  codeHot: "#a9d4ff",
  codeWhite: "#eaf4ff",
  alertRed: "#e01432",
  alertMagenta: "#ff2fd0",
  lime: "#b6ff1a",
  cyan: "#25f4ff",
  amber: "#ffa415",
  white: "#ffffff",
} as const;

/** Flat colours the "signal tear" bars are filled with. */
export const TEAR_COLORS = [
  "#ff2fd0",
  "#b6ff1a",
  "#25f4ff",
  "#ffa415",
  "#e01432",
  "#ffffff",
  "#7a1cff",
  "#00d4a0",
] as const;

export const FONTS = {
  /** Scrolling crash-log / source-code background. */
  code: "CyberCode",
  /** "SYSTEM HACKED" — blocky, LED-panel feel. */
  pixel: "CyberPixel",
  /** "Cyber Attack" — soft rounded geometric. */
  round: "CyberRound",
} as const;
