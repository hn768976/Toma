// Matches the reference clip: 14.9s at 30fps.
export const FPS = 30;
export const DURATION_IN_FRAMES = 447;

// Composition is authored at 4K. Render with `--scale=0.5` for 1080p.
export const WIDTH = 3840;
export const HEIGHT = 2160;

// Lattice layout (world units). Cells are taller than wide, like the
// portrait code panels in the reference.
export const COLS = 13; // odd so the camera centers on a panel
export const ROWS = 9;
export const PITCH_X = 1.0;
export const PITCH_Y = 1.35;
export const CUBE_DEPTH = 0.4; // front opening -> back panel
export const PANEL_W = 0.86;
export const PANEL_H = 1.19;

// Number of distinct scrolling code sheets shared across panels.
export const SHEET_COUNT = 8;
export const SHEET_WIDTH = 1024;
export const SHEET_HEIGHT = 4096;
// Fraction of a sheet visible on one panel at a time (keeps glyphs
// square on the portrait panel).
export const SHEET_WINDOW = (SHEET_WIDTH * (PANEL_H / PANEL_W)) / SHEET_HEIGHT;
