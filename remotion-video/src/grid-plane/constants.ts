// Scene configuration for the warped grid plane ("spacetime fabric").
//
// Everything here is in world units and degrees, and is deliberately
// resolution-independent: the only place pixels enter the render is the
// line width, which is expressed at 4K and rescaled from
// useVideoConfig() so the 1080p preview and the 4K render are the same
// image at different sampling densities.

export const FPS = 30;

// 8s loop. Frame DURATION_IN_FRAMES lands exactly back on frame 0, so
// the rendered range 0..239 is seamless.
export const DURATION_IN_FRAMES = 240;

export const BASE_WIDTH = 1920;
export const BASE_HEIGHT = 1080;

// --- Camera -------------------------------------------------------------
// Low camera looking slightly down at a ground plane. FOV is vertical;
// with a 12 deg downward pitch a 46 deg vertical FOV puts the geometric
// horizon at ~25% from the top of frame:
//   screenY = tan(pitch) / tan(fov/2) = 0.2126 / 0.4252 = 0.5 half-heights
// above centre, i.e. 25% down from the top edge.
export const CAMERA_HEIGHT = 2;
export const CAMERA_PITCH_DEG = 12;
export const CAMERA_FOV_DEG = 46;
export const CAMERA_NEAR = 0.1;
export const CAMERA_FAR = 200;

// Optional, barely-there yaw drift. One full cycle per loop, so it
// closes seamlessly.
export const YAW_DRIFT_DEG = 0.3;

// --- Grid ---------------------------------------------------------------
// Cell size is chosen so ~9 columns span the bottom edge of frame, which
// matches the reference's cell density. (The frame's bottom corners sit
// much further away than its bottom centre once the camera is pitched, so
// the count that actually shows is roughly twice what a flat
// frustum-width estimate suggests.)
export const CELL_SIZE = 1;
export const SEGMENTS_X = 120; // x from -60 to +60
export const SEGMENTS_Z = 120; // z from -1 to -121, well past where the fog kills it
// Near edge sits just in front of the camera (which is at z = 0). Kept
// strictly negative so no vertex ever lands behind the near plane, where
// the screen-space line expansion below would blow up.
export const GRID_NEAR_Z = -1;

// The whole loop: the grid slides toward the camera by exactly this many
// cells over DURATION_IN_FRAMES, so at frame 240 the geometry is
// bit-identical to frame 0. This is what makes the loop free.
export const CELLS_PER_LOOP = 8;

// --- Displacement -------------------------------------------------------
// Two layers of 4D simplex noise. The two extra dimensions trace a circle
// in time -- noise(x, z, cos(2pi t), sin(2pi t)) -- so the field returns
// to itself at t = 1.
//
// Note the noise is sampled in *world* space, not in the grid's own
// scrolling frame. That is deliberate and it is what makes the loop
// possible at all: a field that scrolled with the travel would have to be
// periodic along z with period CELLS_PER_LOOP * CELL_SIZE (5 units), and
// a 5-unit repeat across a 54-unit deep plane is glaringly obvious. With
// a world-anchored field the swell stays put while the wireframe travels
// through it, which is also what the reference does -- its bulge holds
// roughly the same screen position for the whole clip.
export const SWELL_AMPLITUDE = 0.45;
export const SWELL_FREQUENCY = 0.075; // ~13 unit features
export const SWELL_TIME_RADIUS = 0.32;

export const RIPPLE_AMPLITUDE = 0.09;
export const RIPPLE_FREQUENCY = 0.3; // ~3 unit features
export const RIPPLE_TIME_RADIUS = 0.5;

export const NOISE_SEED = 1337;

// --- Line look ----------------------------------------------------------
// Widths in pixels *at 4K*; scaled by (height / 2160) at render time.
export const LINE_WIDTH_NEAR_PX = 1.5;
export const LINE_WIDTH_FAR_PX = 0.7;
export const LINE_WIDTH_FADE_NEAR = 3; // world depth where thinning starts
export const LINE_WIDTH_FADE_FAR = 40; // world depth where it bottoms out

export const LINE_ALPHA_NEAR = 0.9;
// Exponential depth fog, matched to the black background: distant cells
// simply dissolve instead of ending on a hard horizon line.
export const FOG_DENSITY = 0.065;
export const FOG_START_DEPTH = 3;

// Per-column brightness jitter. The lines running away from the camera
// carry the unevenness (as in the reference); the horizontal rows stay
// uniform, because they scroll and any per-row pattern would visibly
// step by one row each time the grid wraps.
export const COLUMN_BRIGHTNESS_MIN = 0.7;
export const COLUMN_BRIGHTNESS_MAX = 1.35;
export const ROW_BRIGHTNESS = 1;
export const ACCENT_COLUMN_CHANCE = 0.12;
export const ACCENT_BRIGHTNESS_BOOST = 0.35;

// --- Bloom --------------------------------------------------------------
// A second pass over the same geometry: wider quads with a gaussian
// falloff across their width, faded out quickly with depth so only the
// near lines pick up a halo.
export const GLOW_WIDTH_PX = 7;
export const GLOW_ALPHA_SCALE = 0.4;
export const GLOW_DEPTH_FALLOFF = 0.16;

// --- Background ---------------------------------------------------------
export const BACKGROUND_TOP = "#02040a";
export const BACKGROUND_BOTTOM = "#000000";
export const VIGNETTE = "rgba(0, 0, 0, 0.55)";

// --- Starfield ----------------------------------------------------------
export const STAR_COUNT = 500;
export const STAR_SEED = 90210;
export const STAR_MIN_SIZE_PX = 1; // at 4K
export const STAR_MAX_SIZE_PX = 2;
export const STAR_MIN_BRIGHTNESS = 0.2;
export const STAR_MAX_BRIGHTNESS = 0.9;
export const TWINKLING_STAR_CHANCE = 0.12;
// Twinkle periods in frames. Each divides DURATION_IN_FRAMES so the
// starfield loops with everything else.
export const TWINKLE_PERIODS = [60, 80, 120];
export const STAR_TINTS = ["#ffffff", "#ffffff", "#ffffff", "#cfe0ff", "#ffe7cc"];

