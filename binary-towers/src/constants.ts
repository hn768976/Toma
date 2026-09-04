/**
 * Composition is authored at 4K. Everything downstream (camera, tower sizes,
 * texture cell metrics) is resolution independent, so a 1080p preview is
 * `--scale=0.5` of the exact same frame.
 */
export const WIDTH = 3840;
export const HEIGHT = 2160;
export const FPS = 30;
export const DURATION_IN_FRAMES = 360; // 12s

/**
 * Character content is regenerated every CONTENT_STEP frames. 360 / 2 = 180
 * content steps per loop; every per-cell flip period below divides 180, which
 * is what makes the digit content exactly periodic over the composition.
 */
export const CONTENT_STEP = 2;
export const CONTENT_STEPS = DURATION_IN_FRAMES / CONTENT_STEP; // 180

/** Flip periods (in content steps). Each one divides CONTENT_STEPS. */
export const FLIP_PERIODS = [6, 9, 10, 12, 15, 18, 20, 30, 36, 45, 60, 90];

/** Texture cell metrics, in texture pixels. */
export const CELL_W = 44;
export const CELL_H = 68;
export const FONT_SIZE = 54;

/** Rows baked into one tower texture. The texture tiles vertically. */
export const TEX_ROWS = 48;

/**
 * World size of one character cell. Tower height = visibleRows * CELL_WORLD_H,
 * so a UV scroll of exactly 1.0 moves the digits TEX_ROWS * CELL_WORLD_H world
 * units — an exact integer multiple of the cell height, for any tower.
 */
export const CELL_WORLD_H = 0.62;
export const CELL_WORLD_W = 0.5;

/** Run-lengths between bright heads, in rows. Each divides TEX_ROWS. */
export const HEAD_PERIODS = [6, 8, 12, 16, 24];

export const MONO_FAMILY = "BinaryTowersMono";
