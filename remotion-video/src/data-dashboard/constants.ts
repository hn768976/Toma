// Shared timing, geometry and palette for the four financial-dashboard
// motion graphics (DashboardV1 - DashboardV4).
//
// Everything below is authored in "stage units". A stage unit equals one
// pixel at 1080p, and every version draws into a single <svg> with a
// viewBox in those units, so the exact same component tree renders the
// 1080p and the 4K composition. `resolutionScale` only changes the pixel
// size of that <svg> element (and the CSS perspective distance, which is
// a real-pixel length) - never any geometry. See DashboardStage.

export const FPS = 30;

export const BASE_WIDTH = 1920;
export const BASE_HEIGHT = 1080;

// Durations match the four reference clips, re-timed to 30fps.
export const DURATION_V1 = 300; // 10s
export const DURATION_V2 = 300; // 10s
export const DURATION_V3 = 420; // 14s
export const DURATION_V4 = 300; // 10s

// The dashboard "screen" is authored larger than the frame so the camera
// can tilt, pan and push in without ever exposing an edge it shouldn't.
export const STAGE_WIDTH = 3000;
export const STAGE_HEIGHT = 1800;

export const STAGE_CENTER_X = STAGE_WIDTH / 2;
export const STAGE_CENTER_Y = STAGE_HEIGHT / 2;

// The board (background fill, grid, LED texture) is drawn past the edges
// of the stage so a tilted, pulled-back camera can never catch the end of
// the screen. The SVG is rendered with overflow visible for this reason.
export const BLEED = 900;

export const BLEED_RECT = {
  x: -BLEED,
  y: -BLEED,
  width: STAGE_WIDTH + BLEED * 2,
  height: STAGE_HEIGHT + BLEED * 2,
};

// Series line colors, shared across versions so the four films read as
// one family even though each has its own layout.
export const SERIES_COLORS = {
  cyan: "#4fd2ff",
  sky: "#3d9bf5",
  amber: "#f2a33c",
  yellow: "#ece55e",
  salmon: "#ff7f6b",
  mint: "#9fe86a",
  lilac: "#c79bf0",
  white: "#eaf3ff",
  red: "#ff5a52",
  green: "#46d18b",
};

// Chip / label treatment, taken from the references: a flat blue tag
// behind a bold light label.
export const CHIP_FILL = "#1668c7";
export const CHIP_FILL_SOFT = "rgba(22, 104, 199, 0.72)";

export const FONT_MONO = '"Roboto Mono", "DejaVu Sans Mono", monospace';
export const FONT_LABEL = '"Barlow", "Liberation Sans", system-ui, sans-serif';
