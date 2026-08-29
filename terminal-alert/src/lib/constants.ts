// Composition geometry. The canvas backing store is always full 4K regardless of
// the --scale used at render time, so every pixel measurement below is in 4K space.
export const WIDTH = 3840;
export const HEIGHT = 2160;
export const FPS = 30;
export const DURATION = 300;

// Terminal text metrics. 60 rows at a 36px leading is exactly one screen height,
// which makes the scrolling block tile against itself with no visible repeat.
export const FONT_SIZE = 26;
export const LINE_HEIGHT = 36;
export const ROWS = 60;
export const COLUMNS = 3;
export const COL_CHARS = 78;
export const MARGIN_X = 40;
export const BLOCK_HEIGHT = ROWS * LINE_HEIGHT; // 2160 — one full frame

// Banner geometry.
export const BANNER_W_RATIO = 0.6;
export const BANNER_H_RATIO = 0.09;
export const BANNER_FONT_SIZE = 170;
export const BANNER_TRACKING = 40;
export const BANNER_PAD_X = 140;
