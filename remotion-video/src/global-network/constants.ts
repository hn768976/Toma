// Timing, geometry and palette for the "global network" motion graphic.
//
// Everything is authored in a fixed 1920x1080 SVG user-space (the
// VIEWBOX below) and the <svg> is stretched to whatever the composition
// resolution is. That makes 4K a pure vector upscale of the 1080p comp:
// identical framing, stroke weights, blur radii and particle counts, no
// per-resolution tuning anywhere.

export const FPS = 30;

// The reference clip is 15.04s. At 30fps the nearest whole frame count
// is 451 (15.0333s).
export const DURATION_IN_FRAMES = 451;

export const WIDTH = 1920;
export const HEIGHT = 1080;

export const VIEWBOX_WIDTH = 1920;
export const VIEWBOX_HEIGHT = 1080;
export const CENTER_X = VIEWBOX_WIDTH / 2;
export const CENTER_Y = VIEWBOX_HEIGHT / 2;

// --- Geometry, in viewBox units at camera scale 1 ---------------------

export const GLOBE_RADIUS = 275;

// The speckled "city lights" band hugging the globe silhouette.
export const DOT_COUNT = 150;
export const DOT_BAND_INNER = 1.0; // x GLOBE_RADIUS
export const DOT_BAND_OUTER = 1.09; // x GLOBE_RADIUS

// Two persistent neon rings, at rest, as multiples of GLOBE_RADIUS.
export const RING_RADII = [2.18, 3.23];

// The rings open bunched in at this fraction of their resting radii and
// swing out to full over RING_EXPAND_FRAME frames.
export const RING_EXPAND_FROM = 0.76;
export const RING_EXPAND_FRAME = 45;

// Extra rings racing out past the frame edge during the opening second.
export const RIPPLE_COUNT = 3;
export const RIPPLE_INTERVAL = 14; // frames between ripple spawns
export const RIPPLE_TRAVEL = 30; // frames from birth to fully faded

export const BOKEH_COUNT = 78;

// --- Camera -----------------------------------------------------------
// Opens tight on the globe, pulls back hard for the first ~1.2s, then
// creeps back in almost imperceptibly for the rest of the shot.
export const CAMERA_START_SCALE = 1.36;
export const CAMERA_SETTLE_SCALE = 0.91;
export const CAMERA_END_SCALE = 1.0;
export const CAMERA_SETTLE_FRAME = 36;

// --- Motion periods (frames) ------------------------------------------

export const GRADIENT_SPIN_PERIOD = 900; // neon gradient sweep
export const DOT_SPIN_PERIOD = 1500; // city-light band rotation
export const ICON_ORBIT_PERIOD = 2400; // icon ring rotation
export const TWINKLE_PERIOD = 41;

export type Palette = {
  /** Flat backdrop underneath the two atmospheric blooms. */
  backdrop: string;
  /** Warm bloom, upper right. */
  bloomWarm: string;
  /** Cool bloom, lower left. */
  bloomCool: string;
  vignette: string;
  /** Neon ring gradient, read top-right -> bottom-left. */
  neon: [string, string, string];
  globeFillInner: string;
  globeFillOuter: string;
  /** Colours cycled through by the city-light dots. */
  dots: string[];
  /** Colours cycled through by the icons + their leader lines. */
  icons: string[];
  /** Colours cycled through by the background bokeh. */
  bokeh: string[];
};

// Version 1 — matched to the reference: gold/amber sweeping into
// cyan/azure over a desaturated navy-teal night sky.
export const PALETTE_REFERENCE: Palette = {
  backdrop: "#0e1a25",
  bloomWarm: "rgba(196, 132, 38, 0.42)",
  bloomCool: "rgba(24, 116, 128, 0.34)",
  vignette: "rgba(4, 8, 14, 0.58)",
  neon: ["#ffd24a", "#3ad0c8", "#2b7ff5"],
  globeFillInner: "#1d2c4e",
  globeFillOuter: "#141f36",
  dots: ["#8fe04a", "#3ad0c8", "#ffd24a", "#e9f3ff", "#54b0f0"],
  icons: ["#ffd24a", "#5cc9e8", "#e8734a", "#e9f3ff", "#8fe04a", "#7fa6d8"],
  bokeh: ["#9aa84f", "#3ad0c8", "#ffd24a", "#54b0f0"],
};

// Version 2 — dark blue. Rings, sky and blooms collapse onto a single
// navy->azure axis; the icons keep their multi-hue accents so they still
// read against it.
export const PALETTE_DARK_BLUE: Palette = {
  backdrop: "#040a16",
  bloomWarm: "rgba(28, 68, 158, 0.34)",
  bloomCool: "rgba(10, 40, 104, 0.32)",
  vignette: "rgba(1, 3, 10, 0.74)",
  neon: ["#a8e4ff", "#3d9bff", "#1d46cc"],
  globeFillInner: "#14224c",
  globeFillOuter: "#0a1230",
  dots: ["#9fd8ff", "#3fa0ff", "#e9f3ff", "#5f7fe8", "#7fd0ff"],
  icons: ["#ffd24a", "#5cc9e8", "#e8734a", "#e9f3ff", "#8fe04a", "#7fa6d8"],
  bokeh: ["#2f6ad0", "#3fa0ff", "#7fd0ff", "#1b3fb8"],
};
