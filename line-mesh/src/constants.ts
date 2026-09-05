export const FPS = 30;
export const DURATION_IN_FRAMES = 360; // 12s, one seamless loop
export const WIDTH = 3840;
export const HEIGHT = 2160;

/** Ribbon width, DOF blur etc. are authored in these units so a --scale render
 *  is a faithful downscale of the 4K frame rather than a different picture. */
export const COMPOSITION_WIDTH = WIDTH;

/** Line count and samples-per-line for the merged ribbon geometry. */
export const LINES = 640;
export const SAMPLES = 340;

/** The glow pass only has to be blurry, so it rides a coarser copy of the mesh. */
export const GLOW_LINES = 220;
export const GLOW_SAMPLES = 170;

/** Opaque backing grid. Fine enough that no fold pokes through the lines. */
export const FILL_COLS = 420;
export const FILL_ROWS = 260;
