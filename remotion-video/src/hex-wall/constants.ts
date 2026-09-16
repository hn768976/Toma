/**
 * Timing and layout constants for the hexagon-wall pulse animation.
 *
 * The reference clip is 9.04s at 25fps; at 30fps the closest match is
 * 271 frames (9.033s).
 */

export const FPS = 30;
export const DURATION_IN_FRAMES = 271;

export const HD_WIDTH = 1920;
export const HD_HEIGHT = 1080;

export const UHD_WIDTH = 3840;
export const UHD_HEIGHT = 2160;

/** Circumradius of a single hexagon in world units. Everything scales off this. */
export const HEX_RADIUS = 1;

/** Pointy-top hexagons: columns are sqrt(3)*R apart, rows 1.5*R apart. */
export const COL_SPACING = Math.sqrt(3) * HEX_RADIUS;
export const ROW_SPACING = 1.5 * HEX_RADIUS;

/** Shrink factor that opens up the seam between neighbouring tiles. */
export const HEX_FILL = 0.985;

/** Depth of each hexagonal prism. Deep enough that the wall never opens up. */
export const HEX_DEPTH = 4;

/** How far a tile travels towards the camera at the peak of a wave. */
export const MAX_EXTRUSION = 4.2;

/** Grid size. Odd counts keep the grid centred on the origin. */
export const GRID_COLS = 33;
export const GRID_ROWS = 23;

/** Visible height of the wall plane in world units (sets the camera distance). */
export const VIEW_HEIGHT = 26;
export const CAMERA_FOV = 44;
