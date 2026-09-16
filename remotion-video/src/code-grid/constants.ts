// Timing, geometry and look configuration for the CodeGrid compositions.
//
// Everything sized in world units is expressed as a multiple of one grid
// cell (CELL = 1), and everything sized in pixels is expressed at 1x
// (1080p) and multiplied by `resolutionScale` for the 4K composition. That
// keeps the two output sizes visually identical rather than merely
// similar: at 4K the blocks are the same size in the frame, the code text
// is the same size on each face, and the depth-of-field blur covers the
// same fraction of the image.

// --- Output ---------------------------------------------------------------

export const FPS = 30;

// 450 frames = 15.000s, the exact length of the reference clip.
export const DURATION_IN_FRAMES = 450;

export const BASE_WIDTH = 1920;
export const BASE_HEIGHT = 1080;

// --- Grid -----------------------------------------------------------------

/** Size of one grid cell in world units. All lengths below are multiples. */
export const CELL = 1;

/**
 * Cells the camera travels forward over one loop.
 *
 * This is what makes the clip seamless. The block field is generated as a
 * tile that is exactly LOOP_CELLS deep and then repeated, so after the
 * camera has covered LOOP_CELLS it is looking at a field identical to the
 * one it started on. Every other motion (sway, bob, yaw, brightness
 * ripple) uses a whole number of cycles per loop, so frame 450 reproduces
 * frame 0 exactly and the video can run on repeat with no visible cut.
 */
export const LOOP_CELLS = 32;

/** Half-width of the generated field, in cells. */
export const FIELD_HALF_WIDTH = 26;

/** Furthest / nearest generated cell relative to the camera start (z = 0). */
export const FIELD_Z_FAR = -62;
export const FIELD_Z_NEAR = 6;

/** Footprint of a block as a fraction of its cell, leaving the dark gutter. */
export const BLOCK_FOOTPRINT = 0.9;

/** Chance a block claims a second cell and becomes a rectangular slab. */
export const WIDE_BLOCK_CHANCE = 0.22;

/** Chance a cell is left empty, which opens the dark canyons in the field. */
export const EMPTY_CELL_CHANCE = 0.05;

/** Block height bands: [min, max, weight]. Mostly slabs, a few towers. */
export const HEIGHT_BANDS: readonly [number, number, number][] = [
  [0.14, 0.4, 0.66], // flat panels
  [0.4, 0.72, 0.26], // mid blocks
  [0.72, 1.25, 0.08], // occasional towers
];

/** Whole cycles per loop of the per-block height pulse. */
export const HEIGHT_PULSE_CYCLES = 2;
export const HEIGHT_PULSE_AMOUNT = 0.06;

/** Whole cycles per loop of the brightness ripple travelling down the field. */
export const RIPPLE_TIME_CYCLES = 3;
/** Whole ripple wavelengths per LOOP_CELLS, so the ripple tiles with the field. */
export const RIPPLE_SPACE_CYCLES = 2;
export const RIPPLE_AMOUNT = 0.3;

// --- Camera ---------------------------------------------------------------

/**
 * Long-ish lens, low to the field and pitched slightly down, which is what
 * puts the vanishing point just under the top edge of the reference frame
 * and lets the field fill the bottom two thirds.
 */
export const CAMERA_FOV = 32;
export const CAMERA_HEIGHT = 2.24;
export const CAMERA_PITCH_DEG = -16;

/** Loop-periodic drift. Amplitudes in cells / degrees, cycles are integers. */
export const CAMERA_SWAY_X = 1.7;
export const CAMERA_SWAY_CYCLES = 1;
export const CAMERA_BOB_Y = 0.1;
export const CAMERA_BOB_CYCLES = 2;
export const CAMERA_YAW_DEG = 2.1;
export const CAMERA_ROLL_DEG = 1.1;
export const CAMERA_PITCH_DRIFT_DEG = 1.3;

export const CAMERA_NEAR = 0.1;
export const CAMERA_FAR = 90;

// --- Atmosphere -----------------------------------------------------------

/** Exponential fog density per cell; the field is gone by ~26 cells out. */
export const FOG_DENSITY = 0.105;

// --- Depth of field -------------------------------------------------------

/** Distance in front of the camera that stays sharp. */
export const FOCUS_DISTANCE = 6.4;
export const FOCUS_BREATH = 0.6;
export const FOCUS_BREATH_CYCLES = 1;

/** How quickly the image goes soft in front of / behind the focal plane. */
export const DOF_NEAR_RANGE = 3.6;
export const DOF_FAR_RANGE = 8.0;

/** Blur sigmas in pixels at 1x, for the two cascaded blur levels. */
export const DOF_BLUR_SIGMA_NEAR = 4;
export const DOF_BLUR_SIGMA_FAR = 9;

/**
 * The blur levels render at a fraction of the frame size. They are blurs,
 * so the detail is being thrown away regardless, and this is what keeps a
 * software-rasterised 4K frame to a sane cost.
 */
export const DOF_BLUR_RESOLUTION = 0.5;

// --- Bloom ----------------------------------------------------------------

export const BLOOM_STRENGTH = 1.05;
export const BLOOM_RADIUS = 0.72;
export const BLOOM_THRESHOLD = 0.2;

// --- Code texture ---------------------------------------------------------

/** Code sheet edge length in pixels at 1x. Doubled for the 4K composition. */
export const CODE_SHEET_SIZE = 2048;

/** Sheet pixels covering one world unit, i.e. the on-block text size. */
export const CODE_PIXELS_PER_UNIT = 512;

export const CODE_FONT_FAMILY = "CodeGridMono";
export const CODE_FONT_FILE = "fonts/DejaVuSansMono.ttf";

/** Font size and line height in sheet pixels at 1x. ~22 lines per block. */
export const CODE_FONT_SIZE = 17;
export const CODE_LINE_HEIGHT = 23;
export const CODE_COLUMN_WIDTH = 10.2;

export const RANDOM_SEED = 0x5eed1234;
