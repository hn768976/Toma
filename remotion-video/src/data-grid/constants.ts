// Timing and camera geometry for the 3D data field.
//
// A perspective fly-through: elements are seeded through a depth volume
// and the camera travels forward through it at a constant rate. Unlike a
// flat zoom, near elements sweep past fast and large while distant ones
// barely crawl — that depth parallax is what reads as 3D.
//
// Every size here is in *base* pixels (a virtual 1920x1080 frame) and is
// multiplied by a resolution scale at render time, so the 4K
// composition is a true 2x render rather than an upscale.

export const FPS = 30;
export const BASE_WIDTH = 1920;
export const BASE_HEIGHT = 1080;

export const DURATION_IN_SECONDS = 20;
export const DURATION_IN_FRAMES = DURATION_IN_SECONDS * FPS; // 600

export const CENTER_X = BASE_WIDTH / 2;
export const CENTER_Y = BASE_HEIGHT / 2;

/**
 * Pinhole camera. FOCAL is in base pixels: an element at depth FOCAL is
 * drawn at 1:1, closer ones grow, further ones shrink.
 */
export const FOCAL = 1000;

/** The depth slab the field occupies. */
export const Z_NEAR = 260;
export const Z_FAR = 2100;
export const Z_DEPTH = Z_FAR - Z_NEAR;

/**
 * Elements are recycled to the back of the slab as they pass the camera.
 * Crossing the slab a whole number of times over the clip is what makes
 * the export loop — frame 600 lands back exactly on frame 0.
 */
export const DEPTH_CROSSINGS = 2;
export const TRAVEL_PER_FRAME = (DEPTH_CROSSINGS * Z_DEPTH) / DURATION_IN_FRAMES;

/**
 * Fractions of the slab spent fading. Elements fade in at the back and
 * out again before they get close enough to fill the frame, so nothing
 * ever pops and nothing balloons.
 */
export const FADE_IN = 0.14;
export const FADE_OUT = 0.09;

// Parallax drift, in world units. Real depth makes this read properly:
// near elements swing further across the frame than distant ones. Whole
// numbers of periods, again for the loop.
export const DRIFT_X_AMPLITUDE = 60;
export const DRIFT_Y_AMPLITUDE = 26;
export const DRIFT_X_PERIODS = 1;
export const DRIFT_Y_PERIODS = 2;

/**
 * A gentle barrel warp, as though through a wide lens: positions bow
 * toward the optical centre by CURVE/2 of their offset at mid-frame.
 */
export const CURVE = 0.08;

/** How far outside the frame an element may sit before it is culled. */
export const CULL_MARGIN = 0.12;

/**
 * World extents the field is seeded across. Wide enough that the far
 * plane still fills a 16:9 frame once projected.
 */
export const FIELD_HALF_X = 2150;
export const FIELD_HALF_Y = 1240;

/**
 * Element counts are totals, not on-screen counts. With a depth slab
 * this deep only about a third project inside the frame at any moment —
 * the near ones are mostly off the edges, which is what a fly-through
 * looks like.
 */
export const NODE_COUNT = 1650;
export const READOUT_COUNT = 620;
export const DASH_COUNT = 700;
export const BLOCK_COUNT = 75;

/** The pool of readout values, transcribed from the reference clip. */
export const READOUT_VALUES = [
  "875.73", "271.85", "904.59", "618.19", "405.06", "486.10", "226.34",
  "604.87", "724.75", "245.21", "698.11", "431.70", "937.89", "714.93",
  "125.32", "543.82", "457.23", "385.08", "484.98", "500.53", "587.11",
  "255.20", "529.39", "428.37", "576.23", "365.08", "738.07", "139.75",
  "168.61", "924.56", "774.72", "816.00", "831.32", "951.21", "312.92",
  "445.02", "947.89", "861.30", "711.43", "745.85", "846.87", "716.99",
  "178.60", "615.97", "399.51", "818.01", "731.42", "211.91", "884.60",
  "776.04", "447.23", "911.24", "791.36", "183.04", "358.21", "641.66",
  "933.46", "572.68", "284.06", "471.66", "137.66", "628.40", "990.12",
] as const;
