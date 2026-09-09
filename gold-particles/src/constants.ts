// Timing, geometry and colour configuration for the particle wave.
//
// Everything spatial is expressed as a fraction of frame HEIGHT and
// multiplied up at draw time from useVideoConfig(), so the 4K
// composition and any downscaled preview read identically — sizes,
// blur radii and travel distances all scale together.

export const FPS = 30;

// 20s loop. Every periodic quantity below (particle cycles, sparkle
// periods, glow drift, grain rotation) must divide evenly into this so
// frame 0 and frame 600 are the same picture.
export const DURATION_IN_FRAMES = 600;

export const BASE_WIDTH = 3840;
export const BASE_HEIGHT = 2160;

// ---------------------------------------------------------------------------
// The field
// ---------------------------------------------------------------------------

// Total particles in the field. A slice of these is always off-frame
// (below the bottom edge, or above the top where they have faded out),
// which lands the visible count in the 700-1200 range the look needs.
export const PARTICLE_COUNT = 1750;

// Faked depth: 0 = near, 1 = far. Particles are bucketed so each bucket
// can share one cached sprite instead of needing a per-particle filter.
export const DEPTH_BUCKETS = 6;

// Particle diameter as a fraction of frame height, interpolated
// exponentially from near to far. Near particles become soft discs
// several times the size of the far pinpoints.
export const SIZE_NEAR = 0.024;
export const SIZE_FAR = 0.0022;
export const SIZE_JITTER = [0.7, 1.45] as const;

// Sprite hardness per depth bucket (0 = fully diffuse blur, 1 = hard
// core). Near orbs are heavily blurred, there is a sharp band in the
// mid range, and the far pinpoints are only slightly soft.
export const BUCKET_SHARPNESS = [0.02, 0.2, 0.55, 0.92, 0.82, 0.64] as const;

// Buckets that get a bloom halo. Deliberately only the sharp mid band —
// if the big near orbs glow, the depth reads inverted.
export const BLOOM_BUCKETS = [3, 4] as const;
export const BLOOM_SIZE_MULTIPLIER = 5.5;
export const BLOOM_ALPHA = 0.15;

// Frames for one full bottom-to-top traversal, per depth bucket. Near
// particles rise noticeably faster than far ones — that parallax is the
// only depth cue there is, since there's no camera. Each value must
// divide DURATION_IN_FRAMES.
export const BUCKET_CYCLE = [200, 300, 300, 600, 600, 600] as const;

// A particle travels (visible span + margins) * this, so it is safely
// off-frame at both ends of its cycle and the reset is never seen. The
// jitter also decorrelates speed within a bucket.
export const TRAVEL_MARGIN = 0.12; // fraction of frame height, each end
export const TRAVEL_JITTER = [1.0, 1.4] as const;

// Brightness by depth: dim near, brightest just past the middle, dim far.
export const DEPTH_PEAK = 0.56;
export const DEPTH_PEAK_WIDTH = 0.32;
export const DEPTH_FLOOR = 0.35;

// Density is highest low in frame and thins upward, so the field reads
// as rising out of the glow. `y` normalised 1 = bottom edge, 0 = top.
export const VERTICAL_FADE_FLOOR = 0.07;
export const VERTICAL_FADE_POWER = 2.6;

// Particles must out-read the glow they are rising out of, so the field
// carries a gain on top of the falloffs; it is clamped at draw time.
export const PARTICLE_GAIN = 1.7;

// Gentle horizontal falloff, so the field concentrates under the glow
// instead of filling the frame evenly.
export const HORIZONTAL_FADE_FLOOR = 0.38;
export const HORIZONTAL_FADE_WIDTH = 0.44;

// ---------------------------------------------------------------------------
// Turbulence
// ---------------------------------------------------------------------------

// Two-octave curl-like displacement field. Sampled on a circle in time
// (integer harmonics of the 600-frame loop) so the field itself repeats.
// Glitter drifts; this is deliberately far gentler than an ember clip.
export const WANDER_AMP_1 = [0.009, 0.022] as const; // fraction of height
export const WANDER_AMP_2 = [0.003, 0.009] as const;
export const WANDER_TIME_HARMONICS_1 = [1, 2] as const;
export const WANDER_TIME_HARMONICS_2 = [2, 3] as const;
export const WANDER_WAVELENGTH_1 = [1.4, 2.6] as const; // cycles per frame height
export const WANDER_WAVELENGTH_2 = [4, 7] as const;
export const WANDER_VERTICAL_RATIO = 0.35; // vertical wander is subtler

// ---------------------------------------------------------------------------
// Sparkles — the glitter read
// ---------------------------------------------------------------------------

// Fraction of the field eligible to sparkle, and how often each does.
// Periods must divide DURATION_IN_FRAMES. duration/period across the
// eligible set lands ~3-5% of the field flashing at any moment.
export const SPARKLE_SHARE = 0.85;
export const SPARKLE_PERIODS = [40, 50, 60, 75] as const;
export const SPARKLE_DURATIONS = [2, 3, 3, 4] as const;
// Only particles in this depth range sparkle — near blurred orbs
// flashing would look like a lighting bug, not glitter.
export const SPARKLE_DEPTH_RANGE = [0.18, 1] as const;
// Cross arm span as a fraction of frame height. A few pixels at 4K —
// enough to read as glitter, not as drawn star shapes.
export const SPARKLE_CROSS_SIZE = 0.011;
export const SPARKLE_CORE_SIZE = 0.0036;
export const SPARKLE_BLOOM_SIZE = 0.022;
export const SPARKLE_BLOOM_ALPHA = 0.3;

// ---------------------------------------------------------------------------
// Background glow
// ---------------------------------------------------------------------------

// Three stacked elliptical gradients centred just below the lower edge.
// The offsets differ per layer so the result is not a perfect radial
// gradient, and each drifts and breathes over the loop.
export const GLOW_LAYERS = [
  // radius (x height), centre offset x/y (x width/height), aspect, drift
  { radius: 1.6, offsetX: -0.025, offsetY: 1.18, aspect: 1.45, driftX: 0.012, driftHarmonic: 1, breathe: 0.03 },
  { radius: 0.68, offsetX: 0.035, offsetY: 1.09, aspect: 1.2, driftX: 0.017, driftHarmonic: 2, breathe: 0.045 },
  { radius: 0.26, offsetX: 0.012, offsetY: 1.03, aspect: 1.1, driftX: 0.01, driftHarmonic: 1, breathe: 0.06 },
] as const;

// Fine grain, ~1.5%. Doubles as dithering for the glow gradient, which
// is the real banding risk in the encoded file.
export const GRAIN_TILE_SIZE = 256;
export const GRAIN_TILE_COUNT = 12; // divides DURATION_IN_FRAMES
export const GRAIN_ALPHA = 0.032;
