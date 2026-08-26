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

// The depth direction (cameraDirection), the near plane, the blur ceiling
// and the motion-blur tap fan are per-variant — see variants.ts. Everything
// in this file is shared by every variant.

// Total number of chips in the field, spread across the paths.
export const CHIP_COUNT = 960;

// Whole path traversals each chip completes in one 450-frame loop. Must be a
// non-zero integer or the loop will not close.
export const FLOW_SPEED = 1;

// How hard each path arcs away from a straight ray. 0 = a straight shaft.
export const CURVE_AMOUNT = 0.2;

// Overall multiplier on the glow baked into chip sprites and on the bloom
// passes composited over the field.
export const GLOW_STRENGTH = 1;

// ---------------------------------------------------------------------------
// Corridor geometry
// ---------------------------------------------------------------------------

// Where the vanishing point sits and which way the paths fan out from it
// are per-variant — see variants.ts. They have to be, because the two
// variants flow in opposite directions relative to that point.

// Number of curved paths radiating from the vanishing point.
export const PATH_COUNT = 16;

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
//     z(u) = zNear * (Z_FAR / zNear) ^ (u ^ depthEase)
//
// so screen radius r = FOCAL / z decays exponentially too. With depthEase 1,
// evenly spaced u gives evenly spaced *ratios* on screen: chips are wide
// apart near the camera and pack tightly toward the vanishing point, and
// screen speed dr/du is proportional to r, i.e. chips accelerate as they
// approach. zNear and depthEase are per-variant; see variants.ts.

export const FOCAL = 5600;
export const Z_FAR = 34;

// Chip width as a fraction of screen radius. Constant, which is what makes
// chip size scale correctly with perspective (inversely with depth z, and
// so proportionally to distance from the vanishing point).
//
// This is coupled to CHIP_COUNT: chips are evenly spaced in log-radius, so
// the gap between neighbours on a path is also a fixed fraction of radius,
// namely (Z_FAR/zNear)^(PATH_COUNT/CHIP_COUNT) - 1. Keep that above
// CHIP_WIDTH_RATIO or the runs close up into continuous streaks.
export const CHIP_WIDTH_RATIO = 0.07;

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

// Per-chip base alpha range.
export const CHIP_ALPHA_MIN = 0.55;
export const CHIP_ALPHA_MAX = 1;

// Only a narrow band of u is in focus. Blur climbs toward both the camera
// and the vanishing point from here. Where the band sits is per-variant
// (sharpCenterU); how wide it is, is shared.
export const SHARP_HALF_WIDTH_U = 0.07;

// Ramp shape between the sharp band and the blur ceiling.
export const BLUR_EXPONENT = 1.35;

// The far end never blurs as hard as the near end — its chips are already
// tiny, and burying them under 30px would erase the corridor's far wall.
export const FAR_BLUR_SCALE = 0.5;

// Blur is quantised to these levels so chips sharing a level can be drawn
// as one batch under a single canvas filter. The table is written against
// BLUR_LEVEL_REFERENCE and rescaled to whatever ceiling a variant sets.
export const BLUR_LEVEL_REFERENCE = 30;
export const BLUR_LEVELS = [0, 2, 5, 9, 14, 21, 30];

// Resolution each blur tier renders its band at, before being blurred and
// blitted back up. Blurring a 30px gaussian at full 4K resolution, once per
// band, is the single most expensive thing this composition could do — and
// at that radius there is nothing left in the image that a full-resolution
// pass would preserve.
export const BLUR_TIER_FULL_MAX = 3;
export const BLUR_TIER_HALF_MAX = 12;
export const BLUR_TIER_SCALES = { full: 1, half: 0.5, quarter: 0.25 };

// Chips nearer than this u get the 3-tap motion-blur smear.
export const MOTION_BLUR_U = 0.16;

// Tap weights and span are per-variant; see variants.ts.

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
// Where in the corridor sparkles may sit, as a fraction of the near-plane
// screen radius.
export const SPARKLE_INNER_RADIUS = 0.08;
export const SPARKLE_OUTER_RADIUS = 0.95;
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
// Blur radii are in final-frame pixels; the bloom canvases themselves are
// rendered at BLOOM_SCALE and upscaled by the browser. A bloom is pure low
// frequency, so a quarter-resolution pass is visually indistinguishable
// from a full-resolution one and roughly sixteen times cheaper — which
// matters a lot when the wide pass is a 46px gaussian over a 4K frame.
export const BLOOM_SCALE = 0.25;
export const BLOOM_TIGHT_BLUR = 12;
export const BLOOM_TIGHT_ALPHA = 0.4;
export const BLOOM_WIDE_BLUR = 46;
export const BLOOM_WIDE_ALPHA = 0.32;

export const VIGNETTE_ALPHA = 0.22;
export const VIGNETTE_INNER_STOP = 0.42;

// Directional shadow across the left of the frame, on top of the radial
// vignette. The corridor converges into that corner, so the shadow buries
// the vanishing point and lets the field brighten as it comes forward —
// which is what stops the convergence reading as a hot spot.
export const SHADOW_ALPHA = 0.95;
// A mid stop, so the shadow holds near-full strength across the left edge
// before easing out. A plain two-stop ramp starts lifting immediately and
// reads as a mechanical wipe rather than depth.
export const SHADOW_MID_STOP = 0.2;
export const SHADOW_MID_ALPHA = 0.74;
// How far across the frame the shadow has fully faded out.
export const SHADOW_EXTENT = 0.58;
// Gradient axis, in CSS degrees. Slightly past 90 so the top-left corner
// sits deeper in shadow than the bottom-left.
export const SHADOW_ANGLE = 100;

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
