/**
 * Everything is authored in a fixed 1920x1080 "design space" and scaled up by
 * the composition, so the 4K comps are geometrically identical to the 1080p
 * ones but resolved at full 4K (SVG strokes, text and glow all scale cleanly).
 */
export const DESIGN_WIDTH = 1920;
export const DESIGN_HEIGHT = 1080;

export const FPS = 30;
/** Matches the reference clip exactly: 300 frames at 30fps = 10.000s. */
export const DURATION_IN_FRAMES = 300;

export const HD_WIDTH = 1920;
export const HD_HEIGHT = 1080;
export const UHD_WIDTH = 3840;
export const UHD_HEIGHT = 2160;

export type ThemeName = "neon" | "paper" | "lite";

export type Theme = {
  /** Page background behind the 3D plane. */
  bg: string;
  /** Radial wash sitting on the background, adds depth to the void. */
  wash: string;
  /** Primary wall linework. */
  wall: string;
  /** Hot core drawn inside the heaviest walls. Empty string disables it. */
  core: string;
  /** Secondary linework: fixtures, stair treads, door leaves. */
  detail: string;
  /** Hairline construction / dimension lines. */
  hairline: string;
  /** Dimension numerals. */
  text: string;
  /** Room + area tags. */
  textStrong: string;
  /** Plane dot grid. */
  dot: string;
  /** Bloom radius in design px. 0 disables the glow filter entirely. */
  glow: number;
  glowColor: string;
  /** Opacity of the non-load-bearing partition walls within the plan. Lower
   *  values push them back; higher values make the plan read as one solid
   *  drawing. */
  partitions: number;
  /** Haze colour pulled over the far (top) half of the plane. */
  haze: string;
  /** Corner vignette strength, 0..1. */
  vignette: number;
  vignetteColor: string;
  /** Stroke widths in plan units (inches). */
  wallStroke: number;
  hairStroke: number;
  /** Target room footprint in inches. Smaller = denser plan. */
  roomSize: number;
  /** Fraction of walls that receive a dimension label. */
  labelDensity: number;
  /** Draw the outer dimension chains with tick marks. */
  chains: boolean;
};

export const THEMES: Record<ThemeName, Theme> = {
  // Reference match: cyan neon on near-black, heavy bloom, two plan layers.
  neon: {
    bg: "#04070f",
    wash: "#0d2036",
    wall: "#4ae6ff",
    core: "#d8f8ff",
    detail: "#2fbde8",
    hairline: "#2685b4",
    text: "#61bdf7",
    textStrong: "#8ad6f7",
    dot: "#123650",
    glow: 5,
    glowColor: "#1fb8ff",
    partitions: 0.88,
    haze: "#04070f",
    vignette: 0.72,
    vignetteColor: "#01040a",
    wallStroke: 3.6,
    hairStroke: 1.15,
    roomSize: 285,
    labelDensity: 0.85,
    chains: true,
  },
  // Light theme: printed-paper blueprint, blue ink, no bloom.
  paper: {
    bg: "#eaeef4",
    wash: "#ffffff",
    wall: "#16468f",
    core: "",
    detail: "#4a76b8",
    hairline: "#8ba4c6",
    text: "#2a5ea8",
    textStrong: "#0f3468",
    dot: "#c2cddd",
    glow: 0,
    glowColor: "#16468f",
    partitions: 0.88,
    haze: "#eef2f7",
    vignette: 0.32,
    vignetteColor: "#8c9cb4",
    wallStroke: 3.4,
    hairStroke: 1.05,
    roomSize: 285,
    labelDensity: 0.8,
    chains: true,
  },
  // Lightweight: same dark palette, calmer — fewer rooms, no bloom, no
  // second layer, gentler move. Made to sit behind overlaid titles.
  lite: {
    bg: "#050a14",
    wash: "#0a1a2c",
    wall: "#38c6e8",
    core: "",
    detail: "#2190b6",
    hairline: "#1a6889",
    text: "#4ea4d4",
    textStrong: "#71c4e8",
    dot: "#0e2a3c",
    glow: 0,
    glowColor: "#2fb9dd",
    partitions: 0.58,
    haze: "#050a14",
    vignette: 0.5,
    vignetteColor: "#01040a",
    wallStroke: 3.1,
    hairStroke: 1,
    roomSize: 300,
    labelDensity: 0.38,
    chains: false,
  },
};
