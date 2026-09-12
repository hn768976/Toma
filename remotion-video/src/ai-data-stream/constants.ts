// Timing, camera, field and theme config for the AI data-stream text field.
// Everything is defined in 1x (1080p) design pixels / world units and
// multiplied by `resolutionScale` at draw time, so the 1080p and 4K
// compositions are pixel-for-pixel the same picture at different sizes.

export const FPS = 30;

// 20s. The camera travels exactly one FIELD_DEPTH over the duration and
// every periodic motion divides into DURATION_IN_FRAMES, so the last
// frame flows seamlessly back into frame 0 when looped.
export const DURATION_IN_FRAMES = 600;

export const BASE_WIDTH = 1920;
export const BASE_HEIGHT = 1080;

// Pinhole camera. A label at z = FOCAL_LENGTH is drawn at 1:1 scale.
export const FOCAL_LENGTH = 1000;
export const NEAR_Z = 220; // closest a label gets before wrapping to the back
export const FIELD_DEPTH = 2600; // z span of the wrapped tunnel
export const FOCUS_Z = 980; // depth-of-field focus plane

// World extents of the label cloud (at scale 1). Wide enough that the far
// end still covers most of the frame.
export const FIELD_HALF_WIDTH = 2300;
export const FIELD_HALF_HEIGHT = 1350;
export const LABEL_COUNT = 430;

// Slow elliptical camera drift, one full period per loop.
export const CAMERA_DRIFT_X = 240;
export const CAMERA_DRIFT_Y = 380;

// Font sizes (px at 1:1 scale) with pick weights: mostly small telemetry,
// a few large "headline" labels.
export const FONT_SIZES: { size: number; weight: number }[] = [
  { size: 22, weight: 4 },
  { size: 26, weight: 4 },
  { size: 32, weight: 3 },
  { size: 42, weight: 2 },
  { size: 56, weight: 1 },
];

// Depth of field (px at 1x). Blur ramps from 0 at the focus plane up to
// these values at the near / far ends of the field. Labels flying past the
// camera smear hard; the far background only goes a little soft.
export const NEAR_BLUR_PX = 26;
export const FAR_BLUR_PX = 7;

// Blur is not applied per label (hundreds of large filtered fills per
// frame is what makes 4K crawl). Instead every label is drawn into the two
// bucket layers whose radii bracket its own blur, weighted so the mix reads
// as a continuous blur, and each bucket is blurred once. Softer buckets are
// drawn at reduced resolution since the blur hides the loss anyway.
export const BLUR_BUCKETS: { radius: number; downscale: number }[] = [
  { radius: 0, downscale: 1 },
  { radius: 2, downscale: 1 },
  { radius: 4.5, downscale: 1 },
  { radius: 8, downscale: 2 },
  { radius: 13, downscale: 2 },
  { radius: 19, downscale: 4 },
  { radius: 26, downscale: 4 },
];

// Approximate advance width of JetBrains Mono, for cheap culling.
export const MONO_ADVANCE_EM = 0.6;
export const LETTER_SPACING_EM = 0.05;

// Per-label brightness flicker periods (frames). All divide 600.
export const FLICKER_PERIODS = [20, 24, 30, 40, 50];

// Occasional horizontal-slice glitch: a label may glitch during a
// GLITCH_SLOT-frame window with probability GLITCH_CHANCE, for GLITCH_LENGTH frames.
export const GLITCH_SLOT = 40; // divides 600
export const GLITCH_CHANCE = 0.14;
export const GLITCH_LENGTH = 3;

export const FONT_FAMILY = "JetBrains Mono";

export type Theme = {
  name: "dark" | "light";
  // CSS background painted under the canvases.
  background: string;
  // Text palette; each label picks one colour and keeps it.
  palette: string[];
  // How labels accumulate on the drawing canvas.
  composite: GlobalCompositeOperation;
  // Bloom layer: a blurred copy of the text pass blended over the crisp one.
  bloomBlend: "screen" | "multiply";
  bloomOpacity: number;
  bloomBlurPx: number;
  // Second, tighter bloom pass that gives the crisp text its halo.
  haloBlurPx: number;
  haloOpacity: number;
  // Chromatic fringing on out-of-focus foreground labels.
  aberrationColors: [string, string];
  aberrationAlpha: number;
  // Overlays.
  scanlineColor: string;
  vignette: string;
  // How far the dimmest (farthest) label fades: 1 = no dimming.
  farDim: number;
};

export const DARK_THEME: Theme = {
  name: "dark",
  background:
    "radial-gradient(ellipse 70% 60% at 50% 50%, #0b1034 0%, #070a24 45%, #03040f 100%)",
  palette: ["#5cf3ff", "#b9c7ff", "#f1f4ff", "#8d97ff", "#5563de", "#5cf3ff"],
  composite: "lighter",
  bloomBlend: "screen",
  bloomOpacity: 0.6,
  bloomBlurPx: 18,
  haloBlurPx: 4,
  haloOpacity: 0.75,
  aberrationColors: ["#ff4fd8", "#35e8ff"],
  aberrationAlpha: 0.32,
  scanlineColor: "rgba(0, 0, 0, 0.13)",
  vignette: "rgba(1, 2, 12, 0.72)",
  farDim: 0.5,
};

export const LIGHT_THEME: Theme = {
  name: "light",
  background:
    "radial-gradient(ellipse 70% 60% at 50% 50%, #ffffff 0%, #f1f4fc 45%, #d9e0f3 100%)",
  palette: ["#0a8397", "#2f3ab0", "#171c4f", "#5058c9", "#7b84b9", "#0a8397"],
  composite: "source-over",
  bloomBlend: "multiply",
  bloomOpacity: 0.3,
  bloomBlurPx: 14,
  haloBlurPx: 3,
  haloOpacity: 0.45,
  aberrationColors: ["#e23aa4", "#1aa8d2"],
  aberrationAlpha: 0.2,
  scanlineColor: "rgba(20, 30, 80, 0.05)",
  vignette: "rgba(110, 125, 185, 0.35)",
  farDim: 0.38,
};

export const THEMES: Record<Theme["name"], Theme> = {
  dark: DARK_THEME,
  light: LIGHT_THEME,
};
