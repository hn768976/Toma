export const WIDTH = 3840;
export const HEIGHT = 2160;
export const FPS = 30;
/** 12.0 seconds. Every period in the piece divides evenly into this. */
export const DURATION_IN_FRAMES = 360;

/** Grid pitch in plane-local units, which is roughly screen pixels at 4K. */
export const GRID_PITCH = 150;

/**
 * The wrap-around tile every plane's content is laid out on. Both are whole
 * multiples of GRID_PITCH so the grid wraps with the elements, and the drift
 * covers exactly one tile over DURATION_IN_FRAMES so frame 0 and frame 360
 * are identical.
 */
export const TILE_U = 2400;
export const TILE_V = 2250;

/** How far outside the frame the planes are extended, to hide their edges. */
export const PLANE_MARGIN = 140;

/**
 * The text wall's line box, and the height of one vertically tiled block. The
 * block is taller than the frame's rotated coverage, so no line is ever on
 * screen twice and the vertical wrap never reads as a repeat.
 */
export const WALL_LINE_HEIGHT = 28;
export const WALL_BLOCK_LINES = 112;
export const WALL_BLOCK_HEIGHT = WALL_LINE_HEIGHT * WALL_BLOCK_LINES;
export const WALL_ROTATION_DEG = -6;
