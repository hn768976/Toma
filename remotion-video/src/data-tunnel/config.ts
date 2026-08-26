// Top-level configuration for the "data tunnel" corridor.
//
// No colours live here — those are in theme.ts. Everything below is
// geometry, timing and intensity.

export const FPS = 30;
export const WIDTH = 3840;
export const HEIGHT = 2160;

// 450 frames @ 30fps = 15.0s. Every periodic quantity in this animation has
// a period that divides 450 exactly, so frame 450 is pixel-identical to
// frame 0 and the clip loops seamlessly.
export const DURATION_IN_FRAMES = 450;

// ---------------------------------------------------------------------------
// The five headline knobs, plus the one that v2 flips.
// ---------------------------------------------------------------------------

// Signed depth direction. THE ONLY PLACE the flow direction is expressed.
//   +1  camera retreats — chips flow away, toward the vanishing point (v1)
//   -1  camera advances — chips rush toward the viewer (v2)
// Every z / depth calculation multiplies by this, and the motion-blur trail
// direction is derived from it, so v2 is a one-line change.
export const CAMERA_DIRECTION = 1;

// Total number of chips in the field, spread across the paths.
export const CHIP_COUNT = 560;

// Whole path traversals each chip completes in one 450-frame loop. Must be a
// non-zero integer or the loop will not close.
export const FLOW_SPEED = 1;

// How hard each path arcs away from a straight ray. 0 = a straight shaft.
export const CURVE_AMOUNT = 0.2;

// Maximum per-chip blur in destination pixels at 4K.
export const BLUR_CEILING = 30;

// Overall multiplier on the glow baked into chip sprites and on the bloom
// passes composited over the field.
export const GLOW_STRENGTH = 1;

// ---------------------------------------------------------------------------
// Corridor geometry
// ---------------------------------------------------------------------------

// Vanishing point, off-centre toward the upper left.
export const VANISHING_POINT = { x: WIDTH * 0.25, y: HEIGHT * 0.35 };

// Number of curved paths radiating from the vanishing point.
export const PATH_COUNT = 14;

// Angular wedge the paths fan across, in radians, measured from the
// vanishing point with +y pointing down the screen. Runs from up-and-right,
// around through right, to down-and-slightly-left.
export const PATH_ANGLE_START = -0.42;
export const PATH_ANGLE_END = 2.02;

// Fraction of a slot each path angle may wander, so the fan is uneven.
export const PATH_ANGLE_JITTER = 0.42;

// The paths all bend the same way (so the corridor reads as one bending
// tube) by this fraction of CURVE_AMOUNT, then vary around it.
export const PATH_CURVE_BIAS = 0.7;
export const PATH_CURVE_SPREAD = 0.45;

// Reference radius the quadratic bend is normalised against.
export const CURVE_REFERENCE_RADIUS = 3300;

// ---------------------------------------------------------------------------
// Perspective
// ---------------------------------------------------------------------------
//
// A chip's depth parameter u runs 0 (right at the camera) to 1 (at the
// vanishing point). Depth is exponential in u:
//
//     z(u) = Z_NEAR * (Z_FAR / Z_NEAR) ^ u
//
// so screen radius r = FOCAL / z decays exponentially too. Evenly spaced u
// therefore gives evenly spaced *ratios* on screen: chips are wide apart
// near the camera and pack tightly toward the vanishing point, and screen
// speed dr/du is proportional to r, i.e. chips accelerate as they approach.

export const FOCAL = 4400;
export const Z_NEAR = 1.35;
export const Z_FAR = 34;

// Chip width as a fraction of screen radius. Constant, which is what makes
// chip size scale correctly with perspective (inversely with depth z, and
// so proportionally to distance from the vanishing point).
export const CHIP_WIDTH_RATIO = 0.115;

// Per-chip multiplier on that width, seeded.
export const CHIP_WIDTH_VARIANCE = 0.28;

// Chip aspect ratios (width / height). All wider than tall.
export const CHIP_ASPECTS = [2.0, 2.8, 3.8];

// Share of chips drawn as outlines rather than solid fills.
export const HOLLOW_FRACTION = 0.3;

// Share of HOLLOW chips that carry tiny illegible tick marks inside.
export const TICKED_HOLLOW_FRACTION = 0.45;

// Sideways scatter off the path centreline, in depth-1 world units.
export const CHIP_LATERAL_SPREAD = 0.055;

// Fraction of a slot a chip may slide along its path, so spacing varies.
export const CHIP_SPACING_JITTER = 0.4;

// ---------------------------------------------------------------------------
// Depth response: alpha, blur, motion blur
// ---------------------------------------------------------------------------

// Chips fade in over this span of u as they leave the vanishing point...
export const FADE_IN_U = 0.14;
// ...and fade out over this span of u as they sweep past the camera.
export const FADE_OUT_U = 0.06;

// Far chips are dimmed to this fraction on top of the fade, so the far end
// of the corridor reads as a dim haze rather than a wall of chips.
export const FAR_DIM = 0.5;

// Per-chip base alpha range.
export const CHIP_ALPHA_MIN = 0.55;
export const CHIP_ALPHA_MAX = 1;

// Only a narrow band of u is in focus. Blur climbs toward both the camera
// and the vanishing point from here.
export const SHARP_CENTER_U = 0.42;
export const SHARP_HALF_WIDTH_U = 0.07;

// Ramp shape between the sharp band and the blur ceiling.
export const BLUR_EXPONENT = 1.35;

// The far end never blurs as hard as the near end — its chips are already
// tiny, and burying them under 30px would erase the corridor's far wall.
export const FAR_BLUR_SCALE = 0.5;

// Blur is quantised to these levels so chips sharing a level can be drawn
// as one batch under a single canvas filter.
export const BLUR_LEVELS = [0, 2, 5, 9, 14, 21, 30];

// Chips nearer than this u get the 3-tap motion-blur smear.
export const MOTION_BLUR_U = 0.16;

// Alpha weights of the 3 taps, leading tap first. Normalised at use.
export const MOTION_BLUR_TAPS = [1, 0.6, 0.3];

// ---------------------------------------------------------------------------
// Brightness animation
// ---------------------------------------------------------------------------

// Periods a chip's brightness pulse may use, in frames. All divide 450.
export const PULSE_PERIODS = [45, 50, 75, 90, 150, 225];
export const PULSE_AMPLITUDE = 0.3;

// Chips that flash to chip white, per second, for FLASH_FRAMES frames.
export const FLASHES_PER_SECOND = 3;
export const FLASH_MIN_FRAMES = 3;
export const FLASH_MAX_FRAMES = 4;
export const FLASH_ALPHA_BOOST = 1.9;

// ---------------------------------------------------------------------------
// Star sparkles — the only non-chip element in the field
// ---------------------------------------------------------------------------

export const SPARKLE_COUNT = 20;
export const SPARKLE_MIN_SIZE = 45;
export const SPARKLE_MAX_SIZE = 125;
export const SPARKLE_PERIODS = [75, 90, 150, 225];
// Higher = shorter, sharper twinkles.
export const SPARKLE_TWINKLE_EXPONENT = 6;
export const SPARKLE_MAX_ALPHA = 0.9;
export const SPARKLE_BLUR = 3;

// ---------------------------------------------------------------------------
// Camera & finish
// ---------------------------------------------------------------------------

// Ambient drift only — no real camera move. A closed Lissajous figure, so it
// returns exactly to its start at frame 450.
export const DRIFT_PIXELS = 12;
export const DRIFT_PHASE = 1.1;

// Bloom: two screen-blended blurred copies of the field, tight and wide.
export const BLOOM_TIGHT_BLUR = 12;
export const BLOOM_TIGHT_ALPHA = 0.4;
export const BLOOM_WIDE_BLUR = 46;
export const BLOOM_WIDE_ALPHA = 0.32;

export const VIGNETTE_ALPHA = 0.22;
export const VIGNETTE_INNER_STOP = 0.42;

export const GRAIN_ALPHA = 0.04;
export const GRAIN_TILE_SIZE = 512;
export const GRAIN_TILE_COUNT = 8;
export const GRAIN_INTENSITY = 60;

// ---------------------------------------------------------------------------
// Sprite atlas
// ---------------------------------------------------------------------------

// Chips are rasterised once into these two nominal widths and blitted with
// transforms — never re-stroked per chip per frame. Two sizes so far chips
// downscale from a small sprite instead of a large one.
export const SPRITE_WIDTHS = [180, 44];

// Target on-screen chip width below which the small sprite is used.
export const SPRITE_SMALL_THRESHOLD = 60;

// Padding around the chip inside its sprite canvas, as a fraction of the
// sprite's nominal chip width. Holds the baked glow.
export const SPRITE_GLOW_PAD = 0.24;

// Blur radius of the glow baked into a chip sprite, as a fraction of the
// sprite's nominal chip width.
export const SPRITE_GLOW_BLUR = 0.13;

export const TAU = Math.PI * 2;
