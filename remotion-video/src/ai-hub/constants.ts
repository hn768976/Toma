// Timing, geometry and palette for the "AI Hub Network" clip.
//
// Geometry is expressed in *normalised units* where 1 unit = the frame
// height and the origin sits at frame centre. The composition renders
// into an SVG whose viewBox is set up that way, so every value here is
// resolution independent: the same numbers drive the 1080p preview and
// the 4K master.

export const FPS = 30;

// 10s loop. Every periodic motion in the clip is built so that a whole
// number of its cycles fits into this span, which is what makes frame
// 300 land exactly back on frame 0.
export const DURATION_IN_FRAMES = 300;

export const BASE_WIDTH = 3840;
export const BASE_HEIGHT = 2160;

// --- Hub geometry (normalised) -------------------------------------

export const HUB_OUTER_RADIUS = 0.15; // outer ring -> 0.30 x frame height across
export const HUB_OUTER_STROKE = 0.0022; // the thin one
export const HUB_TICK_OUTER = 0.1395;
export const HUB_TICK_INNER = 0.1275;
export const HUB_TICK_COUNT = 84;
export const HUB_INNER_RADIUS = 0.1195; // the thicker one
export const HUB_INNER_STROKE = 0.0058;
export const HUB_DISC_RADIUS = 0.1165;

// Where spokes leave the hub.
export const SPOKE_ORIGIN_RADIUS = 0.158;

// Scale applied to the hand-drawn `Ai` letterforms, which are authored
// in a 0..90 unit local box (see ai-mark.ts).
export const MARK_SCALE = 0.00213;

// --- Network ---------------------------------------------------------

export const NODE_COUNT = 28;

// --- Motion (frames) -------------------------------------------------

// Whole-assembly sway: +/- 3 degrees, one full there-and-back per loop.
export const SWAY_DEGREES = 3;

// Integer turns per loop for the three hub layers. Signs alternate so
// the layers visibly counter-rotate against each other.
export const OUTER_ARC_TURNS = 1;
export const TICK_BAND_TURNS = -2;
export const INNER_DASH_TURNS = 3;

// Fraction of a pulse cycle spent travelling; the rest is the pause
// before the next pulse leaves the hub.
export const PULSE_TRAVEL = 0.72;

// --- Palettes --------------------------------------------------------

export type Theme = {
  field: string; // background navy / teal
  fieldGlow: string; // broad lift behind the hub
  line: string; // spokes, hub rings, node rings
  halftone: string; // background dot grid
  iconPrimary: string;
  iconAccent: string;
  iconAlt: string;
  markStops: [string, string, string]; // top -> bottom of the `Ai` gradient
};

export const THEMES: Record<"blue" | "teal", Theme> = {
  // V1 - reference match: blue field, magenta-to-gold centre.
  blue: {
    field: "#04122e",
    fieldGlow: "#0e3d78",
    line: "#22c8f0",
    halftone: "#1a4a7a",
    iconPrimary: "#f07020",
    iconAccent: "#22c8f0",
    iconAlt: "#ff3b2f",
    markStops: ["#e026c0", "#ff7a1a", "#ffc020"],
  },
  // V2 - cooler and more corporate: teal field, cyan-to-white centre.
  teal: {
    field: "#02181e",
    fieldGlow: "#0a4c54",
    line: "#22e0d0",
    halftone: "#14544f",
    iconPrimary: "#9fe6f0",
    iconAccent: "#ffffff",
    iconAlt: "#5cf0d0",
    markStops: ["#22e0d0", "#8ff2f8", "#ffffff"],
  },
};

export type VariantName = keyof typeof THEMES;
