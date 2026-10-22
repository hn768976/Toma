// Timing matches the reference clip exactly: 12 s at 30 fps = 360 frames.
export const FPS = 30;
export const DURATION_IN_FRAMES = 360;

// Compositions are authored in 4K UHD.
export const WIDTH = 3840;
export const HEIGHT = 2160;

// The dashboard is laid out in abstract "units" on a 16:9 board.
// One world unit in the Three.js scene equals 100 board units.
export const BOARD_W = 3200;
export const BOARD_H = 1800;
export const UNITS_PER_WORLD = 100;

// Texture resolution of the board (texels per board unit). The camera only
// ever frames ~40% of the board, so 2.5 texels/unit keeps text and thin
// strokes crisp at 3840 px wide.
export const TEXELS_PER_UNIT = 2.5;

// Chart geometry (board units).
export const AXIS_X = 900;
export const BASELINE_Y = 1300;
export const BAR_COUNT = 28;
export const BAR_START_X = 950;
export const BAR_SPACING = 50;
export const BAR_WIDTH = 7;
